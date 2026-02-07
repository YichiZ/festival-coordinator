import os
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

load_dotenv(override=True)

ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
CARTESIA_API_KEY = os.environ["CARTESIA_API_KEY"]


async def run_bot(transport: BaseTransport, runner_args: RunnerArguments):
    logger.info("Starting bot")

    stt = CartesiaSTTService(api_key=CARTESIA_API_KEY)

    tts = CartesiaTTSService(
        api_key=CARTESIA_API_KEY,
        voice_id="6ccbfb76-1fc6-48f7-b71d-91ac6298247b", # Tessa, kind and compassionate
        text_filter=MarkdownTextFilter(),
    )

    llm = AnthropicLLMService(
        api_key=ANTHROPIC_API_KEY,
        model="claude-haiku-4-5-20251001",
    )

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

Start by learning the basics: who's in the group, where everyone is based, and what festivals or artists they're interested in.""",
        }
    ]

    context = LLMContext(messages)

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
    )

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info("Client connected")

        messages.append(
            {"role": "system", "content": "Greet the user warmly, introduce yourself as Sophie, and ask who's in the crew and what festivals or artists they're excited about this year."}
        )
        await task.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info("Client disconnected")
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
