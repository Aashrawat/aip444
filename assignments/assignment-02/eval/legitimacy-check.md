# Legitimacy Check

## Legitimate posting — Linear

**Input:** `inputs/advise/linear-fullstack.txt`

| Item | Result |
| ---- | ------ |
| Verdict | **green** (confidence ~0.9) |
| Domain | linear.app |
| Signals observed | Careers presence / active hiring; salary in market band; remote-first culture corroboration; contact domain consistent; WHOIS incomplete (neutral) |

**Agree?** Yes. Linear is a real company with a public careers site; green is correct. Incomplete WHOIS (privacy / `.app` quirks) correctly stayed neutral rather than flipping to red.

## Suspicious / fake posting — GlobalTek scam

**Input:** `inputs/advise/scam-globaltek.txt` (crafted red-flag posting)

| Item | Result |
| ---- | ------ |
| Verdict | **red** (confidence ~0.9) |
| Domain | globaltek-careers-offer.xyz |
| Signals observed | Asks for SSN/SIN, ID copies, bank details; gift-card/wire “equipment deposit”; Gmail contact; brand-new looking domain; no credible careers footprint; absurd weekly pay |

**Agree?** Yes. Multiple classic scam patterns; the report HTML led with a red warning banner while still generating fit/advice sections.

## Extra note — Jane Street (real company, stretch role)

On the weak-fit Jane Street posting the agent returned **yellow**, citing incomplete WHOIS and news about regulatory allegations in India alongside green careers/salary signals. I agree the company is legitimate for job-search purposes; yellow is overly cautious here and shows the agent can overweight tangential news / WHOIS gaps. Still preferable to a false green on the crafted scam.
