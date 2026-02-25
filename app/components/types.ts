export type Persona = { id: string; name: string; content: string };

export const modes = ["Manual", "GitHub", "Linear"] as const;

export type Mode = (typeof modes)[number];
