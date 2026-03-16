'use strict';

/**
 * Batch test: generate 5 articles with real client data and validate output.
 * Usage: node test-batch.js
 */

require('dotenv').config();
process.env.SKIP_PUBLISH = '1';

const fs = require('fs');
const path = require('path');
const { runPipeline } = require('./pipeline');

const practiceTemplate = 'Practice Page (v2Training Module)';
const supportingTemplate = 'supporting';

function practiceSections(keyword, clientName) {
  return [
    { sectionNumber: 1, name: 'H1 + Tagline', details: `Write the keyword "${keyword}" verbatim as the H1. Use proper capitalization. Directly below it on a new line, create a tagline that is 7 words or fewer, value-driven, and includes local relevance.`, wordCount: 7 },
    { sectionNumber: 2, name: 'Definition + Introduction', details: `Create an empathetic opening that connects with the reader about ${keyword}. Acknowledge their fear, stress, and uncertainty. Present ${clientName} as the trusted solution. Write warmly in direct address ("you"). Establish the problem and naturally lead into the next section.`, wordCount: 250 },
    { sectionNumber: 3, name: 'How We Can Help', details: `Expand on the problem and show how ${clientName} solves it: identify the problem, agitate the pain, and show consequences if they don't act. Build on the emotional setup from the intro, explain how the attorney helps, and demonstrate understanding of risks.`, wordCount: 250 },
    { sectionNumber: 4, name: 'Why Choose Us', details: `Explain why ${clientName} is the right choice by highlighting specific strengths: experience, trust signals, and approach. Use short, scannable paragraphs or bullet points.`, wordCount: 500 },
    { sectionNumber: 5, name: 'What to Expect', details: `Explain the legal process step-by-step in simple terms. Describe what working with ${clientName} will be like. Cover consultation, document review, strategy planning, representation, and resolution. Include timelines.`, wordCount: 500 },
    { sectionNumber: 6, name: 'CTA / Conclusion', details: `Summarize the main takeaway and reaffirm empathy while providing clear next steps. Directly instruct the reader to contact the firm. Never use "Conclusion" or "Summary" as the heading.`, wordCount: 200 },
    { sectionNumber: 7, name: 'FAQs', details: `Create 3-5 questions most relevant to the reader, structured as Q&As. Maintain a neutral, informative tone without giving legal advice.`, wordCount: 300 },
  ];
}

function supportingSections(keyword, clientName) {
  return [
    { sectionNumber: 1, name: 'H1 + Intro', details: `Write the keyword "${keyword}" verbatim as the H1. Write a brief 2-3 sentence introduction that answers the core question immediately.`, wordCount: 80 },
    { sectionNumber: 2, name: 'Legal Overview', details: `Explain the legal context, eligibility requirements, and relevant laws for ${keyword}. Include state-specific considerations where applicable.`, wordCount: 300 },
    { sectionNumber: 3, name: 'Key Considerations', details: `Cover practical considerations, common pitfalls, and important details the reader should know. Include external authority references where relevant.`, wordCount: 250 },
    { sectionNumber: 4, name: 'What to Expect', details: `Walk through the process step by step — from initial steps through resolution. Include typical timelines.`, wordCount: 250 },
    { sectionNumber: 5, name: 'CTA', details: `Write a soft, brief call to action. 2-4 sentences max. Suggest speaking with an attorney — no hard sell.`, wordCount: 60 },
    { sectionNumber: 6, name: 'FAQs', details: `Create 3-5 frequently asked questions. Keep concise — 2-3 sentences per answer.`, wordCount: 200 },
  ];
}

const articles = [
  // 1. Practice — Bardol (family law, St. Louis)
  {
    articleid: 'test-batch-01',
    clientId: '86dvn8g14',
    clientName: 'Bardol Law Firm',
    clientInfo: `Bardol Law Firm, LLC is a dedicated St. Louis-based family law firm. Attorneys: Stephen J. Bardol; Ann Vatterott Bruntrager; Mikayla Butler. Practice Areas: Divorce, Custody, Adoption, Orders of Protection. Service Area: St. Louis County, St. Louis City, Jefferson County, St. Charles County. Target pages: https://bardollaw.com/ https://bardollaw.com/practice-areas/st-louis-divorce-lawyer/ https://bardollaw.com/missouri-divorce-laws/ https://bardollaw.com/practice-areas/st-louis-child-custody-lawyer/ https://bardollaw.com/practice-areas/st-louis-spousal-support-alimony-lawyer/ https://bardollaw.com/contact-us/`,
    website: 'https://bardollaw.com',
    keyword: 'Divorce Lawyer St Louis',
    template: practiceTemplate,
    userId: 'test-user',
    get sections() { return practiceSections(this.keyword, this.clientName); },
  },
  // 2. Practice — Scrofano (DUI, DC)
  {
    articleid: 'test-batch-02',
    clientId: 'client_b07c0cf0',
    clientName: 'Scrofano Law PC',
    clientInfo: `Scrofano Law PC is a criminal defense law firm in Washington, DC, focusing on DUI/DWI defense including first-time offenses, repeat offenses, drug-related DUIs, refusal to test, DMV hearings. Service Area: Washington, DC. Target pages: https://www.dc-dui-lawyer.com/ https://www.dc-dui-lawyer.com/dc-felony-dui-lawyer/ https://www.dc-dui-lawyer.com/dc-marijuana-dui-lawyer/ https://www.dc-dui-lawyer.com/dc-2nd-offense-dui-lawyer/ https://www.dc-dui-lawyer.com/dc-dmv-hearing-lawyer/ https://www.dc-dui-lawyer.com/practice-areas/traffic-violations/`,
    website: 'https://www.dc-dui-lawyer.com',
    keyword: 'DC DUI Lawyer',
    template: practiceTemplate,
    userId: 'test-user',
    get sections() { return practiceSections(this.keyword, this.clientName); },
  },
  // 3. Practice — Chang & Diamond (bankruptcy, San Diego)
  {
    articleid: 'test-batch-03',
    clientId: '86dvn8fxy',
    clientName: 'Chang & Diamond, APC',
    clientInfo: `Chang & Diamond, APC is a California bankruptcy law firm with over 25 years experience. Attorneys: Richard E. Chang; Steven J. Diamond. Practice Areas: Chapter 7, Chapter 13 bankruptcy, stopping collections/garnishment/foreclosure. Service Area: San Diego, Imperial, Riverside, San Bernardino, Orange, Los Angeles counties. Target pages: https://www.thebklawyers.com/ https://www.thebklawyers.com/san-diego-chapter-7-bankruptcy-lawyers/ https://www.thebklawyers.com/san-diego-chapter-13-bankruptcy-lawyers/ https://www.thebklawyers.com/creditor-harassment/ https://www.thebklawyers.com/san-diego-debt-relief-attorneys/ https://www.thebklawyers.com/contact-us/`,
    website: 'https://www.thebklawyers.com',
    keyword: 'Bankruptcy Lawyer San Diego',
    template: practiceTemplate,
    userId: 'test-user',
    get sections() { return practiceSections(this.keyword, this.clientName); },
  },
  // 4. Supporting — Cherney (bankruptcy info, Georgia)
  {
    articleid: 'test-batch-04',
    clientId: '86dvn8g4k',
    clientName: 'Cherney Law Firm',
    clientInfo: `Cherney Law Firm, LLC is a Marietta, Georgia bankruptcy law firm. Attorney: Matthew J. Cherney. Over 15 years experience, thousands of cases filed. Practice Areas: Chapter 7, Chapter 13 bankruptcy. Service Area: Metro Atlanta, Marietta, Cobb County, Fulton County, Cherokee County. Target pages: https://cherneylaw.com/ https://cherneylaw.com/marietta-chapter-13-bankruptcy-attorney/ https://cherneylaw.com/tax-debt-relief-attorney/ https://cherneylaw.com/bankruptcy-areas-of-specialty/debt-settlement/ https://cherneylaw.com/contact-cobb-county-office/`,
    website: 'https://cherneylaw.com',
    keyword: 'How to File Chapter 7 Bankruptcy in Georgia',
    template: supportingTemplate,
    userId: 'test-user',
    get sections() { return supportingSections(this.keyword, this.clientName); },
  },
  // 5. Supporting — Bardazzi (immigration info, NY)
  {
    articleid: 'test-batch-05',
    clientId: '86dy6revb',
    clientName: 'Bardazzi Law',
    clientInfo: `Bardazzi Law PLLC is a New York immigration law firm. Attorneys: Emanuele Bardazzi; Manuela Muttoni; Sabrina Duiella. Practice Areas: E-2 visas, O-1 visas, EB-1 green cards, family based green cards, EB-2 NIW green cards. Target pages: https://e-2visaworld.com/ https://e-2visaworld.com/complete-guide-to-the-e-1-visa-requirements/ https://www.bardazzilaw.com/immigration-and-visas/ https://www.bardazzilaw.com https://www.bardazzilaw.com/bardazzi-law-contacts/`,
    website: 'https://www.bardazzilaw.com',
    keyword: 'E-2 Visa Requirements for Investors',
    template: supportingTemplate,
    userId: 'test-user',
    get sections() { return supportingSections(this.keyword, this.clientName); },
  },
];

// ─── Validation ─────────────────────────────────────────────────────────────────

function validate(html, article) {
  const checks = {};

  // Single H1
  const h1Count = (html.match(/<h1>/gi) || []).length;
  checks['Single H1'] = h1Count === 1 ? 'PASS' : `FAIL (${h1Count})`;

  // H1 matches keyword
  const h1Match = html.match(/<h1>([\s\S]*?)<\/h1>/i);
  const h1Text = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim().toLowerCase() : '';
  const kwLower = article.keyword.toLowerCase();
  checks['H1 = keyword'] = h1Text.includes(kwLower) || kwLower.includes(h1Text) ? 'PASS' : `FAIL ("${h1Text}")`;

  // No placeholders
  const placeholders = html.match(/\[[A-Z][a-z]+ [a-z]+\]/g) || [];
  checks['No placeholders'] = placeholders.length === 0 ? 'PASS' : `FAIL (${placeholders.join(', ')})`;

  // No links in headings
  const headingsWithLinks = html.match(/<h[1-3][^>]*>[\s\S]*?<a\s[\s\S]*?<\/h[1-3]>/gi) || [];
  checks['No links in H1-H3'] = headingsWithLinks.length === 0 ? 'PASS' : `FAIL (${headingsWithLinks.length})`;

  // Word count
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = text.split(/\s+/).length;
  checks['Word count'] = `${wordCount}`;

  // Has FAQ
  const hasFaq = /<h[23][^>]*>.*(?:FAQ|Frequently Asked)/i.test(html);
  checks['Has FAQ'] = hasFaq ? 'PASS' : 'FAIL';

  // Link count and distribution
  const links = html.match(/<a\s/gi) || [];
  checks['Links'] = `${links.length} total`;

  // CTA check for supporting pages
  if (article.template === supportingTemplate) {
    // Find CTA section — look for last H2 before FAQ
    const sections = html.split(/<h2>/i);
    // Simple word count of CTA-ish section
    checks['Page type'] = 'supporting';
  } else {
    checks['Page type'] = 'practice';
  }

  return checks;
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const results = [];
  const outputDir = path.join(__dirname, 'test-output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  for (const article of articles) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${article.articleid}: "${article.keyword}"`);
    console.log(`  Client: ${article.clientName} | Type: ${article.template === practiceTemplate ? 'practice' : 'supporting'}`);
    console.log('='.repeat(60));

    try {
      const result = await runPipeline(article);
      const htmlPath = path.join(outputDir, `${article.articleid}.html`);
      const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf8') : '';
      const checks = validate(html, article);

      results.push({
        id: article.articleid,
        keyword: article.keyword,
        client: article.clientName,
        type: article.template === practiceTemplate ? 'practice' : 'supporting',
        wordCount: result.wordCount,
        flesch: result.fleschScore,
        file: htmlPath,
        checks,
      });

      console.log(`  Done: ${result.wordCount} words | Flesch: ${result.fleschScore}`);
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
      results.push({
        id: article.articleid,
        keyword: article.keyword,
        client: article.clientName,
        type: article.template === practiceTemplate ? 'practice' : 'supporting',
        wordCount: 0,
        flesch: 'N/A',
        file: 'N/A',
        checks: { error: err.message },
      });
    }
  }

  // Print summary
  console.log('\n\n' + '='.repeat(80));
  console.log('  BATCH RESULTS SUMMARY');
  console.log('='.repeat(80));
  results.forEach(r => {
    console.log(`\n  ${r.id} | ${r.client} | ${r.type}`);
    console.log(`  Keyword: ${r.keyword}`);
    console.log(`  Words: ${r.wordCount} | Flesch: ${r.flesch}`);
    console.log(`  File: ${r.file}`);
    Object.entries(r.checks).forEach(([k, v]) => {
      console.log(`    ${k}: ${v}`);
    });
  });

  // Write JSON results
  fs.writeFileSync(path.join(outputDir, 'batch-results.json'), JSON.stringify(results, null, 2));
  console.log(`\nResults saved to test-output/batch-results.json`);
}

main().catch(console.error);
