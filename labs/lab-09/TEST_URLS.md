# Credibility test URLs (Lab 09)

Aligned with the CLI vs IDE / AI coding assistants research topic.

| Category | URL | Report | Verdict |
|----------|-----|--------|---------|
| High — government | https://www.nist.gov/news-events/news/2024/01/nist-identifies-types-cyberattacks-manipulate-behavior-ai-systems | `nist-ai-adversarial-machine-learning-credibility.md` | high |
| High — major news | https://www.bbc.com/news/business-65086798 | `bbc-business-65086798-credibility.md` | high |
| Medium — corporate blog | https://github.blog/news-insights/research/research-quantifying-github-copilots-impact-on-developer-productivity-and-happiness/ | `github-copilot-productivity-happiness-credibility.md` | medium |
| Low — personal / opinion | https://medium.com/synthetic-futures/why-im-ditching-github-copilot-after-2-years-c7aab3de22e8 | `medium-synthetic-futures-github-copilot-credibility.md` | low |
| Tricky | https://www.naturalnews.com/2023-05-24-artificial-intelligence-chatgpt-threat-to-humanity.html | `naturalnews-chatgpt-threat-to-humanity-credibility.md` | very_low |

```powershell
npm run analyze -- "https://www.bbc.com/news/business-65086798"
```
