import { GYM_QUESTIONS } from "./gymQuestions";
import { INTERVIEW_EXTRA } from "./interviewQuestions";
import { buildInterview, type InterviewTopic } from "@/game/engine/interview";
import type { Question } from "@/game/engine/question";

/** Which scorecard topic each interview question belongs to. */
export const TOPIC_OF: Readonly<Record<string, InterviewTopic>> = {
  "iv-thread": "Processes",
  "iv-cow": "Memory",
  "iv-mutex-sem": "Scheduling and sync",
  "iv-malloc": "Memory",
  "iv-epoll": "I/O and Linux",
  "iv-ctx": "Scheduling and sync",
  "ivx-vm": "Memory",
  "ivx-pagefault": "Memory",
  "ivx-thrash": "Memory",
  "ivx-deadlock": "Scheduling and sync",
  "ivx-pageseg": "Memory",
  "ivx-segv": "Memory",
  "ivx-forks": "Processes",
  "ivx-zombie": "Processes",
  "ivx-spin": "Scheduling and sync",
  "ivx-inversion": "Scheduling and sync",
  "ivx-eat-fault": "Memory",
  "ivx-eat-tlb": "Memory",
  "ivx-syscall": "I/O and Linux",
  "ivx-mmap": "Memory",
  "ivx-nonblock": "I/O and Linux",
  "ivx-stack-heap": "Processes",
  "ivx-semaphore": "Scheduling and sync",
  "ivx-rr": "Scheduling and sync",
  "ivx-lru": "Memory",
  "ivx-ipc": "Processes",
  "ivx-oom": "I/O and Linux",
  "ivx-dma": "I/O and Linux",
  "ivx-ptentries": "Memory",
};

export const INTERVIEW_QUESTIONS: Question[] = [...GYM_QUESTIONS.interview, ...INTERVIEW_EXTRA];

export const topicOf = (q: Question): InterviewTopic => TOPIC_OF[q.id];

/** The mock interview for `seed`: ten questions across the four topics. */
export const INTERVIEW_LENGTH = 10;
export const mockInterview = (seed: number): Question[] => buildInterview(INTERVIEW_QUESTIONS, topicOf, seed, INTERVIEW_LENGTH);
