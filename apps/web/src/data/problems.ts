export type SealedExpectations = {
  ambiguitiesToClarify: string[];
  missingRequirement: { what: string; why: string };
  trap: { description: string; correctResolution: string };
  edgeCasesToTest: string[];
  designDecisionRedFlags: string[];
};

export type ChatMessage = { text: string; timestamp: string };
export type ChatPersona = { name: string; role: string; initials: string; color: string };
export type ChatFormat = {
  persona: ChatPersona;
  messages: ChatMessage[];
  reactions: { emoji: string; count: number }[];
};

export type Problem = {
  id: number;
  slug: string;
  title: string;
  domain: string;
  difficulty: string;
  estimatedMinutes: number;
  problemStatement: string;
  chatFormat?: ChatFormat | null;
  sealedExpectations?: SealedExpectations;
  starterCode?: Record<string, string> | null;
};
