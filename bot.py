import json
import os
import tempfile
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.transports.daily.transport import DailyParams
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport, parse_telephony_websocket
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

from pipecat.frames.frames import LLMRunFrame, TTSSpeakFrame

from loguru import logger

from tools import create_tools, get_call_info, summarize_transcript
import db

from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from pipecat.utils.tracing.setup import setup_tracing
from pipecat.serializers.twilio import TwilioFrameSerializer
from pipecat.transports.websocket.fastapi import (
    FastAPIWebsocketParams,
    FastAPIWebsocketTransport,
)

load_dotenv(override=True)

ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
CARTESIA_API_KEY = os.environ["CARTESIA_API_KEY"]
IS_TRACING_ENABLED = bool(os.environ["ENABLE_TRACING"])
SCHEMA_SQL = (Path(__file__).parent / "schema.sql").read_text()

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


async def run_bot(transport: BaseTransport, runner_args: RunnerArguments, caller_info: dict | None = None):
    logger.info("Starting bot")

    stt = CartesiaSTTService(api_key=CARTESIA_API_KEY)

    tts = CartesiaTTSService(
        api_key=CARTESIA_API_KEY,
        # voice_id="6ccbfb76-1fc6-48f7-b71d-91ac6298247b",  # Tessa, kind and compassionate
        voice_id="2ba1dbaa-d52b-4984-8bc5-f877e9b03a02", # Yichi
        text_filter=MarkdownTextFilter(),
    )

    llm = AnthropicLLMService(
        api_key=ANTHROPIC_API_KEY,
        model="claude-haiku-4-5-20251001",
    )

    import random

    _filler_phrases = [
        "Hold on a sec.",
        "Let me check on that.",
        "One moment.",
        "Looking that up.",
        "On it.",
    ]
    _user_spoke = False

    @llm.event_handler("on_function_calls_started")
    async def on_function_calls_started(service, function_calls):
        nonlocal _user_spoke
        if _user_spoke and not any(fc.function_name == "end_call" for fc in function_calls):
            _user_spoke = False
            await tts.queue_frame(TTSSpeakFrame(random.choice(_filler_phrases)))

    # --- Session state & tools ---
    session_state: dict = {"group_id": None, "call_id": None}
    if caller_info:
        session_state["from_number"] = caller_info.get("from_number")
        session_state["to_number"] = caller_info.get("to_number")
    transcript_log: list[dict] = []
    tools = create_tools(session_state, llm=llm)

    # Context. Should have the phone and the group, for the context.

    messages = [
        {
            "role": "system",
            "content": f"""You are Alex. You're on a voice call helping a group of friends figure out which festivals to go to, buy tickets, and how to get everyone there without it being a logistical nightmare.

Talk like an excited friend who loves festivals. Keep it short and hype — you're on a call, not writing an email. Ask one or two things at a time.

Early on, suggest a fun group name and ask if they're into it. Once they confirm, call save_group. Save other info (names, cities, festivals, artists) as it comes up, but check with the caller before saving. When the convo wraps up (goodbyes, "that's all," etc.), say something casual like "later!" then call end_call.

You have access to a query_database tool that can answer any question about the data. Here is the database schema for reference:

{SCHEMA_SQL}""",
    
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
        nonlocal _user_spoke
        _user_spoke = True
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

        if session_state.get("from_number"):
            messages.append(
                {
                    "role": "system",
                    "content": "A caller just connected. First, call lookup_caller to identify who is calling. Then greet them warmly by name if they're a known member, or introduce yourself if they're new.",
                }
            )
        else:
            messages.append(
                {"role": "system", "content": "Greet and introduce yourself as Yichi and that you're excited to help plan the trip. Keep it to a few sentences. Ask if it is a good time to talk."}
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

    logger.info(f"Runner arguments: {runner_args}")

    caller_info: dict = {}

    # For Twilio telephony: parse websocket to extract call data for caller identification
    websocket = getattr(runner_args, "websocket", None)
    if websocket is not None:
        _, call_data = await parse_telephony_websocket(websocket)

        # Fetch caller info from Twilio REST API
        caller_info = await get_call_info(call_data["call_id"])
        if caller_info:
            logger.info(
                f"Call from: {caller_info.get('from_number')} to: {caller_info.get('to_number')}"
            )

        serializer = TwilioFrameSerializer(
            stream_sid=call_data["stream_id"],
            call_sid=call_data["call_id"],
            account_sid=os.getenv("TWILIO_ACCOUNT_SID", ""),
            auth_token=os.getenv("TWILIO_AUTH_TOKEN", ""),
        )

        transport = FastAPIWebsocketTransport(
            websocket=websocket,
            params=FastAPIWebsocketParams(
                audio_in_enabled=True,
                audio_out_enabled=True,
                add_wav_header=False,
                vad_analyzer=SileroVADAnalyzer(),
                serializer=serializer,
            ),
        )
    else:
        # Non-telephony transports (Daily, WebRTC)
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

    await run_bot(transport, runner_args, caller_info=caller_info)


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
