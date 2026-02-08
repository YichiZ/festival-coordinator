import json
import os
import tempfile
from datetime import datetime
from dotenv import load_dotenv
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.transports.daily.transport import DailyParams
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.services.anthropic.llm import AnthropicLLMService
from pipecat.services.cartesia.stt import CartesiaSTTService
from pipecat.services.cartesia.tts import CartesiaTTSService
from pipecat.utils.text.markdown_text_filter import MarkdownTextFilter

from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
    UserTurnStoppedMessage,
    AssistantTurnStoppedMessage,
)
from pipecat.turns.user_stop.turn_analyzer_user_turn_stop_strategy import (
    TurnAnalyzerUserTurnStopStrategy,
)
from pipecat.turns.user_turn_strategies import UserTurnStrategies

from pipecat.audio.turn.smart_turn.local_smart_turn_v3 import LocalSmartTurnAnalyzerV3
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams

from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask

from pipecat.frames.frames import LLMRunFrame

from loguru import logger

from tools import create_tools, summarize_transcript
import db

from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from pipecat.utils.tracing.setup import setup_tracing

load_dotenv(override=True)

ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
CARTESIA_API_KEY = os.environ["CARTESIA_API_KEY"]
IS_TRACING_ENABLED = bool(os.environ["ENABLE_TRACING"])

# Initialize tracing if enabled
if IS_TRACING_ENABLED:
    # Create the exporter
    otlp_exporter = OTLPSpanExporter()

    # Set up tracing with the exporter
    setup_tracing(
        service_name="pipecat-demo",
        exporter=otlp_exporter,
    )
    logger.info("OpenTelemetry tracing initialized")


async def run_bot(transport: BaseTransport, runner_args: RunnerArguments):
    logger.info("Starting bot")

    stt = CartesiaSTTService(api_key=CARTESIA_API_KEY)

    tts = CartesiaTTSService(
        api_key=CARTESIA_API_KEY,
        voice_id="6ccbfb76-1fc6-48f7-b71d-91ac6298247b",  # Tessa, kind and compassionate
        text_filter=MarkdownTextFilter(),
    )

    llm = AnthropicLLMService(
        api_key=ANTHROPIC_API_KEY,
        model="claude-haiku-4-5-20251001",
    )

    # --- Session state & tools ---
    session_state: dict = {"group_id": None, "call_id": None}
    transcript_log: list[dict] = []
    tools = create_tools(session_state)

    # Context. Should have the phone and the group, for the context.

    messages = [
        {
            "role": "system",
            "content": """You are Sophie, a friendly and organized festival trip coordinator. You help groups of friends plan festival trips together, even when everyone lives in different cities and life is busy.

Your job is to make the planning process frictionless. You help with:

- Choosing which festivals to attend (lineups, dates, vibes, budget fit)
- Figuring out the best time to buy tickets (presales, on-sale dates, price tiers, resale tips)
- Estimating total trip costs per person (tickets, flights, accommodation, rental cars, food)
- Coordinating travel logistics from multiple cities (flights, carpools, rental cars)
- Finding the best group accommodation options near the venue
- Keeping track of who's in, who's on the fence, and what everyone's availability looks like

Conversation style:
- Keep responses concise and conversational since you're speaking out loud, not writing an essay.
- Be warm, upbeat, and practical. You're the friend who's great at planning.
- Ask 1 to 2 questions at a time to keep the conversation flowing naturally.
- Proactively suggest next steps so things keep moving forward.
- When comparing options, give a quick bottom line recommendation with reasoning.
- Use real approximate numbers when discussing costs so people can make decisions.

Start by learning the basics: who's in the group, where everyone is based, and what festivals or artists they're interested in.

Tools:
- save_group: Call early in the conversation once you know the group name. This creates the planning group and starts tracking the session.
- save_member: Save each friend to the group as you learn their name and city. Call once per person.
- save_festival: Save a festival when the group starts discussing one seriously. Include as much detail as you know (dates, location, price, on-sale date).
- save_artist: Save artists to a festival after it's been saved. Use the festival_id from save_festival.
- get_group_info: Retrieve all saved data for the current group (members, festivals, artists, past call summaries). Use at the start of a returning session or when you need to reference what's been saved.
- end_call: Use when the conversation has clearly concluded—the user says goodbye, thanks, that's all, etc.
  Process: First say a natural goodbye like "Take care!" or "Nice chatting with you!", then call end_call.
  Never use for brief pauses or "hold on" moments.

Important: Proactively save information as you learn it during the conversation. Don't wait to be asked — if someone mentions a friend's name and city, save it. If they mention a festival, save it. This ensures nothing is lost between calls.""",
    
        }
    ]

    context = LLMContext(messages, tools=tools)  # type: ignore[arg-type]

    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            user_turn_strategies=UserTurnStrategies(
                stop=[
                    TurnAnalyzerUserTurnStopStrategy(
                        turn_analyzer=LocalSmartTurnAnalyzerV3()
                    )
                ]
            ),
            vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=0.2)),
        ),
    )

    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            user_aggregator,
            llm,
            tts,
            transport.output(),
            assistant_aggregator,
        ]
    )

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            enable_metrics=True,
            enable_usage_metrics=True,
        ),
        enable_tracing=IS_TRACING_ENABLED,
    )

    # --- Transcript collection via turn events ---

    @user_aggregator.event_handler("on_user_turn_stopped")
    async def on_user_turn_stopped(aggregator, strategy, message: UserTurnStoppedMessage):
        transcript_log.append({
            "role": "user",
            "content": message.content,
            "timestamp": message.timestamp,
        })

    @assistant_aggregator.event_handler("on_assistant_turn_stopped")
    async def on_assistant_turn_stopped(aggregator, message: AssistantTurnStoppedMessage):
        transcript_log.append({
            "role": "assistant",
            "content": message.content,
            "timestamp": message.timestamp,
        })

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info("Client connected")

        messages.append(
            {"role": "system", "content": "Greet the user warmly, introduce yourself as Sophie and that ."}
        )
        await task.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info("Client disconnected")

        # Save full transcript to temp folder for debugging
        if transcript_log:
            tmp_dir = os.path.join(tempfile.gettempdir(), "festival-coordinator")
            os.makedirs(tmp_dir, exist_ok=True)
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            transcript_path = os.path.join(tmp_dir, f"transcript_{ts}.json")
            with open(transcript_path, "w") as f:
                json.dump(transcript_log, f, indent=2, default=str)
            logger.info(f"Saved transcript to {transcript_path}")

        # Post-call: summarize and save transcript + summary to DB
        call_id = session_state.get("call_id")
        if call_id:
            try:
                summary = await summarize_transcript(transcript_log)
                db.end_call_record(call_id, summary, transcript=transcript_log)
                logger.info(f"Saved call summary for call {call_id}")
            except Exception as e:
                logger.error(f"Failed to save call summary: {e}")

        await task.cancel()

    runner = PipelineRunner(handle_sigint=runner_args.handle_sigint)

    await runner.run(task)


async def bot(runner_args: RunnerArguments):
    """Main bot entry point for the bot starter."""

    transport_params = {
        "daily": lambda: DailyParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
        ),
        "webrtc": lambda: TransportParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
        ),
    }

    transport = await create_transport(runner_args, transport_params)

    await run_bot(transport, runner_args)


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
