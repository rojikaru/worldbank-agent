# World Bank Agent

This project focuses on providing a modern LLM with a set of tools to grab the statistics 
on a myriad of topics from all around the globe, analyze and visualize it for the user.

## Used technologies

- [LangChain + LangGraph](https://docs.langchain.com/oss/javascript/langgraph/overview)
- [Agent Chat UI](https://github.com/langchain-ai/agent-chat-ui)
- Turborepo
- Next.js
- World Bank API v2

## How to run

1. Clone the repo
2. Install dependencies (npm, yarn or any other node package manager will suit too)

```bash
pnpm install
```

And dependencies for [Node canvas](https://github.com/Automattic/node-canvas?tab=readme-ov-file#compiling)
(plot tools)

3. Add .env file with one of these keys:

```
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

4. Run the project (npm/yarn or any other node package manager will suit too)

```bash
pnpm run dev
```

## Why is it suitable for tech demo

- Focuses on the core functionality
- Provides easy flow and appealing UI
- Responds to questions about statistics
- Makes plots for easier data representation

## What should I do next

- Add complex analysis tools (thought of Python coder tool + execute
[HITL middleware](https://docs.langchain.com/oss/javascript/langchain/human-in-the-loop))
(in [Pyodide](https://github.com/pyodide/pyodide/tree/main),
maybe even on client side + sending results as a new message in chat history)
- Add authentication
- Speed the frontend up
- Add full-fledged artifacts drawer
- Introduce eval loop
- Deploy to LangSmith or Vercel or any other convenient provider
- Introduce CI/CD

## What went wrong first time

This is my second tryout of this project because first one was a real flop 
and I'm not particularly proud of myself.   
Here's what I personally think turned sour:

- Took recommended technologies list as mandatory requirements and focused on utilizing them
rather than providing business value
- Focused on what I could do best and wasted 3 out of 4 days on API, UI and their integration.
That looked cool code-wise, but didn't really have a proper function/business logic
- Was overwhelmed by recommendations & not googled how to use them and focused on familiar tech stack parts
- Didn't negotiate terms & stack with my team (because of the previous bulletpoint; probably the biggest mistake)
- Because of not googling properly I even stuck with a wrong API
- Didn't fix a few annoying bugs like LangChain streaming of structured response of ChatGPT
- Introduced multi-modality support because of such select on my UI (I am THAT stupid)

## How do I plan to recover

- Speak to humans about the projects, what it does, what I don't understand, what is absolute MUST for demo and what's not
- Give time estimates only if I'm sure I understand how to provide business value with my work
- Treat recruiters, coworkers and literally anyone who can care about my work (stakeholders) as a part of my team
and definitely talk to them
- Show my work to non-tech people and learn to explain what it does and why it's **relevant**
- Find relevant tools for demo projects and try to minimize the time spent on coding
(because re-using already written code is better) 

## Other stuffs you may need

### License
[MIT](LICENSE)

### Demo (how my second try looks)
https://github.com/user-attachments/assets/bc71ce06-d60b-47e7-9ad9-4f2c1891dc40
