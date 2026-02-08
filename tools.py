import os

import anthropic
from pipecat.frames.frames import EndTaskFrame
from pipecat.processors.frame_processor import FrameDirection
from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.services.llm_service import FunctionCallParams
from loguru import logger

import db

SUMMARY_PROMPT = """Summarize this voice conversation between a festival planning assistant (Sophie) and the user. Focus on:

- Who is in the group and where they're based
- Which festivals or artists were discussed
- Any decisions made (committed, passed, considering)
- Ticket timing, budget, or logistics discussed
- Open questions or next steps

Keep it concise (3-8 bullet points). This summary will be used to bring Sophie up to speed on the next call."""


async def summarize_transcript(messages: list) -> str:
    """Call Anthropic to summarize the conversation transcript."""
    # Build a readable transcript from the context messages
    transcript_lines = []
    for msg in messages:
        role = msg.get("role", "unknown")
        content = msg.get("content", "")
        if role == "system":
            continue
        speaker = "Sophie" if role == "assistant" else "User"
        if content:
            transcript_lines.append(f"{speaker}: {content}")

    transcript = "\n".join(transcript_lines)
    if not transcript.strip():
        return "No conversation content to summarize."

    client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[
            {
                "role": "user",
                "content": f"{SUMMARY_PROMPT}\n\n---\n\nTranscript:\n{transcript}",
            }
        ],
    )
    return response.content[0].text  # type: ignore[union-attr]


def create_tools(session_state: dict, llm=None) -> ToolsSchema:
    """Create all function-calling tools for the bot, bound to the given session state.

    If llm is provided, registers each direct function with the LLM service.
    """

    async def end_call(params: FunctionCallParams):
        """End the call. Use when the conversation has clearly concluded—goodbye, thanks, that's all, etc."""
        await params.llm.push_frame(EndTaskFrame(), FrameDirection.UPSTREAM)
        await params.result_callback({"status": "ending"})

    async def save_group(params: FunctionCallParams, name: str):
        """Create or set the active friend group for this planning session.

        Args:
            name: The group name, e.g. "Jake's crew" or "Austin squad".
        """
        group = db.create_group(name)
        session_state["group_id"] = group["id"]
        # Start a call record for this session
        call = db.start_call(group["id"])
        session_state["call_id"] = call["id"]
        logger.info(f"Session group: {group['id']}, call: {call['id']}")
        await params.result_callback({"group_id": group["id"], "group_name": name})

    async def save_member(params: FunctionCallParams, name: str, city: str = ""):
        """Save a friend/member to the current group.

        Args:
            name: The person's name.
            city: The city they live in, e.g. "Austin, TX".
        """
        group_id = session_state.get("group_id")
        if not group_id:
            await params.result_callback({"error": "No active group. Create a group first with save_group."})
            return
        member = db.add_member(group_id, name, city or None)
        await params.result_callback({"member_id": member["id"], "name": name, "city": city})

    async def save_festival(
        params: FunctionCallParams,
        name: str,
        location: str = "",
        dates_start: str = "",
        dates_end: str = "",
        ticket_price: float = 0,
        on_sale_date: str = "",
        status: str = "considering",
    ):
        """Save a festival the group is considering or committed to.

        Args:
            name: Festival name, e.g. "Coachella 2026".
            location: Festival location, e.g. "Indio, CA".
            dates_start: Start date in YYYY-MM-DD format.
            dates_end: End date in YYYY-MM-DD format.
            ticket_price: Estimated ticket price per person.
            on_sale_date: When tickets go on sale in YYYY-MM-DD format.
            status: One of "considering", "committed", or "passed".
        """
        group_id = session_state.get("group_id")
        if not group_id:
            await params.result_callback({"error": "No active group. Create a group first with save_group."})
            return
        festival = db.add_festival(
            group_id,
            name,
            location=location or None,
            dates_start=dates_start or None,
            dates_end=dates_end or None,
            ticket_price=ticket_price or None,
            on_sale_date=on_sale_date or None,
            status=status,
        )
        await params.result_callback({"festival_id": festival["id"], "name": name, "status": status})

    async def save_artist(
        params: FunctionCallParams,
        festival_id: str,
        name: str,
        priority: str = "want_to_see",
    ):
        """Save an artist performing at a festival.

        Args:
            festival_id: The UUID of the festival.
            name: Artist name, e.g. "Kendrick Lamar".
            priority: One of "must_see", "want_to_see", or "nice_to_have".
        """
        artist = db.add_artist(festival_id, name, priority)
        await params.result_callback({"artist_id": artist["id"], "name": name, "priority": priority})

    async def get_group_info(params: FunctionCallParams):
        """Retrieve all saved info for the current group — members, festivals, artists, and recent call summaries."""
        group_id = session_state.get("group_id")
        if not group_id:
            await params.result_callback({"error": "No active group."})
            return
        members = db.list_members(group_id)
        festivals = db.list_festivals(group_id)
        recent_calls = db.get_recent_calls(group_id, limit=3)
        await params.result_callback({
            "group_id": group_id,
            "members": members,
            "festivals": festivals,
            "recent_call_summaries": [
                {"date": c["started_at"], "summary": c["summary"]}
                for c in recent_calls
                if c.get("summary")
            ],
        })

    all_tools = [
        end_call,
        save_group,
        save_member,
        save_festival,
        save_artist,
        get_group_info,
    ]

    # Register each direct function with the LLM so pipecat can execute them
    if llm is not None:
        for fn in all_tools:
            llm.register_direct_function(fn)

    return ToolsSchema(
        standard_tools=all_tools  # type: ignore[arg-type]
    )
