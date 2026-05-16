import { ArticleSection } from "@/types/article";

export interface OutlineTemplate {
  id: string;
  name: string;
  description: string;
  sections: ArticleSection[];
}

// Default section briefs are intentionally substantive — the section-writer
// pipeline produces shallow articles when briefs are one-line stubs (editor
// diffs showed final articles routinely doubling the heading count). Each
// description below tells the model what the section's job IS and what it
// is NOT, matching the section-boundary rules in
// `meerkatv4/prompts/section-writer.md`. Editors can still customize per
// article — these are starting points that produce a deep first draft.

export const OUTLINE_TEMPLATES: OutlineTemplate[] = [
  {
    id: "practice-page",
    name: "Practice Page",
    description:
      "Service page for a specific practice area. Includes Why Choose Us and a direct, conversion-oriented CTA.",
    sections: [
      {
        id: "1",
        title: "Introduction",
        description:
          "Frame the legal problem and the reader's situation in 2–3 short paragraphs. Establish what's at stake and how the firm helps. Include the firm name and city/state in the first 100 words. Keep it informational and neutral — NOT a sales pitch. Do NOT preview process steps (those belong in What to Expect), do NOT list firm credentials (those belong in Why Choose Us), and do NOT use conversion phrases like 'free consultation' or 'call now' (those belong in the CTA).",
        targetWordCount: 250,
      },
      {
        id: "2",
        title: "How We Can Help",
        description:
          "Describe the firm's APPROACH to the legal issue — what the firm does for clients facing this problem, how it analyzes the situation, what kinds of solutions it pursues. Lead with the firm's response, not a re-explanation of the problem (the intro already covered that). Do NOT list firm credentials or differentiators (those go in Why Choose Us). Do NOT walk through procedural steps (those go in What to Expect).",
        targetWordCount: 250,
      },
      {
        id: "3",
        title: "Why Choose Us",
        description:
          "The firm's specific differentiators, drawn from CLIENT DETAILS — credentials, years in practice, attorney backgrounds, focus areas, geographic coverage, recognitions. Use 3–5 H3 sub-headings, each with a CONCRETE differentiator label (e.g., '30+ Years in Family Law', 'Focused Practice in Cobb County'), not vague labels like 'Experience'. Aim for 200+ words of specific detail. Do NOT explain the legal issue. Do NOT describe the legal process. If CLIENT DETAILS is sparse, write fewer H3s grounded in real detail — do not pad with boilerplate trust language.",
        targetWordCount: 350,
      },
      {
        id: "4",
        title: "What to Expect",
        description:
          "The legal process and client experience, walked through step by step. Cover at least 3–5 distinct stages with realistic timelines specific to the jurisdiction. For each stage, describe both what the client does and what the firm does. Reference jurisdiction-specific courts, filing requirements, or statutes where applicable. This is the ONLY section that walks through process steps — the intro and How We Can Help should not preview them. Do NOT pitch the firm or list credentials.",
        targetWordCount: 400,
      },
      {
        id: "5",
        title: "CTA",
        description:
          "Direct call to action. 3–4 short paragraphs (~120 words). Clear ask, brief explanation of next steps, and 2–3 actionable bullet points. Include a local signal (city or county). MUST link to the contact page (/contact, NOT the homepage). This is the section where conversion language belongs — 'free consultation', 'call', 'schedule' are appropriate here. Do NOT re-explain the legal issue or restate firm credentials at length.",
        targetWordCount: 150,
      },
      {
        id: "6",
        title: "FAQ",
        description:
          "3–5 frequently asked questions, each on a DISTINCT sub-topic that wasn't already fully answered in the body. Good FAQ angles: timing edge cases, cost questions, what-if scenarios, eligibility nuances. Each answer is exactly 2 sentences. Do NOT compress and restate the body content — pick angles the body didn't cover. Total FAQ word count must not exceed 25% of the article body.",
        targetWordCount: 300,
      },
    ],
  },
  {
    id: "supporting-page",
    name: "Supporting / Resource Page",
    description:
      "Educational/resource page that answers a specific legal question. Neutral and informational. NO Why Choose Us section (firm promotion belongs only in the soft CTA per SOP).",
    sections: [
      {
        id: "1",
        title: "Introduction",
        description:
          "Briefly frame the question or topic in 2–3 short paragraphs. Surface the core answer immediately — the reader searched this keyword to get an answer, not to wade through preamble. Do NOT mention the firm name in the body of supporting pages (per SOP, firm references go in the CTA only). Keep tone educational and neutral.",
        targetWordCount: 200,
      },
      {
        id: "2",
        title: "Core Answer",
        description:
          "The substantive answer to the keyword question. Cover the primary facts, legal rules, definitions, eligibility requirements, or steps that someone searching this keyword is looking for. Go deep on the central topic. Reference jurisdiction-specific statutes or rules where applicable. The H2 heading must be specific to the keyword and jurisdiction — not a generic label like 'Key Information' or 'Overview'.",
        targetWordCount: 350,
      },
      {
        id: "3",
        title: "Additional Considerations",
        description:
          "Adjacent considerations, edge cases, jurisdictional nuances, common complications, or scenarios where the standard answer shifts. MUST NOT repeat points from the Core Answer section — build on it with depth, do not restate it. The H2 must reflect the specific angle this section covers and be clearly distinct from every other H2 in the article.",
        targetWordCount: 300,
      },
      {
        id: "4",
        title: "What to Expect",
        description:
          "Practical, step-by-step walk-through of the process the reader will go through. Include realistic timelines and what happens at each stage. Reference jurisdiction-specific procedural requirements where applicable. Keep it factual — this is not a firm-services pitch.",
        targetWordCount: 250,
      },
      {
        id: "5",
        title: "Soft CTA",
        description:
          "Brief, soft suggestion to speak with an attorney about the topic — 2–4 sentences, 50–80 words total. This is the ONLY section in a supporting page where the firm name may appear. Use phrases like 'speak with an attorney' or 'consult a lawyer' — NOT 'hire us today' or 'call now for a free consultation'. The H2 should be a natural prompt to seek guidance (e.g., 'When to Speak With an Attorney About [Topic]'), not the literal phrase 'Soft CTA'.",
        targetWordCount: 70,
      },
      {
        id: "6",
        title: "FAQ",
        description:
          "3–5 frequently asked questions, each on a DISTINCT sub-topic that wasn't already fully answered in the body. Each answer is exactly 2 sentences. Do NOT compress and restate body content — pick angles the body didn't cover.",
        targetWordCount: 250,
      },
    ],
  },
];
