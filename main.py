import logging
import os

from line.agent import AgentClass, InputEvent, TurnEnv
from line.events import CallEnded
from line.voice_agent_app import AgentEnv, CallRequest, VoiceAgentApp
from line.llm_agent import LlmAgent, LlmConfig, end_call

logger = logging.getLogger(__name__)

# class MyAgent(AgentClass):
#     def __init__(self, call_request: CallRequest):
#         self._inner = LlmAgent(
#             model="claude-haiku-4-5-20251001",
#             api_key=os.getenv("ANTHROPIC_API_KEY"),
#             tools=[end_call],
#             config=LlmConfig.from_call_request(call_request),
#         )

#     async def process(self, env: TurnEnv, event: InputEvent):
#         logger.info(f"Event for {event}")
#         if isinstance(event, CallEnded):
#             pass  # ...do cleanup
#         else:
#             async for output in self._inner.process(env, event):
#                 yield output


async def get_agent(env: AgentEnv, call_request: CallRequest):
    logger.info(
        f"Starting new call for {call_request.call_id}. "
        f"Agent system prompt: {call_request.agent.system_prompt}"
        f"Agent introduction: {call_request.agent.introduction}"
    )

    agent = LlmAgent(
        model="claude-haiku-4-5-20251001",
        api_key=os.getenv("ANTHROPIC_API_KEY"),
        tools=[end_call],
        config=LlmConfig.from_call_request(call_request),
    )

    return agent

app = VoiceAgentApp(get_agent=get_agent)
if __name__ == "__main__":
    print("Starting app")
    app.run()