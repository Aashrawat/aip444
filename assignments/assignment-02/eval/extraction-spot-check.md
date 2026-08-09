# Extraction Spot-Check

Manual expectations were written from the source text files **before** comparing to `data/jobs/*.json`. Extraction date: 2026-08-09.

## Posting: Software Engineer — Full Stack — Shopify

Source: `inputs/jobs/01-fullstack-shopify.txt` → `data/jobs/software-engineer-full-stack-shopify.json`

| Field | Expected | Extracted | Correct? |
| :---- | :------- | :-------- | :------- |
| Job title | Software Engineer — Full Stack | Software Engineer — Full Stack | ✅ |
| Company | Shopify | Shopify | ✅ |
| Location | Toronto, ON | Toronto, ON | ✅ |
| remote_status | hybrid | hybrid | ✅ |
| posting_age_days | 5 (“Posted: 5 days ago”) | 5 | ✅ |
| Salary range | $110,000 – $150,000 CAD | $110,000 – $150,000 CAD | ✅ |
| Required skills | TypeScript, React, REST APIs, relational DBs / PostgreSQL or MySQL, Git, CI/CD, code review, 3+ years | TypeScript, React, REST APIs, relational databases, PostgreSQL, MySQL, Git, CI/CD, code review | ✅ (experience stored separately) |
| Preferred skills | Ruby on Rails, GraphQL, high-traffic e-commerce, AWS/GCP | Ruby on Rails, GraphQL, high-traffic e-commerce systems, AWS, GCP | ✅ |
| Experience level | 3+ years | 3+ years professional software development | ✅ |
| Education | Bachelor's CS or equivalent | Bachelor's degree in CS or equivalent experience | ✅ |

## Posting: Backend Software Engineer — Stripe

Source: `inputs/jobs/02-backend-stripe.txt` → `data/jobs/backend-software-engineer-stripe.json`

| Field | Expected | Extracted | Correct? |
| :---- | :------- | :-------- | :------- |
| Job title | Backend Software Engineer | Backend Software Engineer | ✅ |
| Company | Stripe | Stripe | ✅ |
| Location / remote | Remote (Canada / US) | location “Canada / US”, remote_status remote | ✅ |
| posting_age_days | ~42 (Posted June 28, 2026 → Aug 9, 2026) | 42 | ✅ |
| Salary range | $140,000 – $190,000 USD | $140,000 – $190,000 USD | ✅ |
| Required skills | Go/Java/Ruby, distributed systems, PostgreSQL, HTTP APIs/security, 4+ years | Listed as skill strings including “Proficiency in Go, Java, or Ruby” and distributed-systems wording | ✅ (slightly verbose packaging) |
| Preferred skills | Fintech/payments, K8s/Terraform, Kafka | Experience in fintech or payments; Kubernetes and Terraform; Kafka or similar | ✅ |
| Education | not listed | null | ✅ |
| Key responsibilities | payment APIs, own services, security/compliance, mentor | Matches posting | ✅ |

## Summary

The extractor was strong on titles, companies, salary, remote status, and posting age when dates were explicit or relative. It correctly used `null` for Stripe education. Minor nit: required skills sometimes include experience phrases as skill list items rather than only technologies. `posting_date_note` was occasionally `null` even when relative dating was used — a prompt tightening would help explain age provenance every time. Company research via Tavily populated useful size/news/culture fields without inventing salary.
