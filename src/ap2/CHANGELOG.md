# ANP_AP2 Notes

This file summarizes the current ANP_AP2 surface area for v1.0a.

## Components

- `types/` – canonical schemas organized by cart, payment, and webhook flows
- `builders.ts` – cart, payment, and webhook builders with unified hash chain helpers
- `utils.ts` – hash utilities (`cartHash`, `paymentMandateHash`, `contentHash`)
- `constants.ts` – TTL settings and version string (`ANP_AP2_VERSION`)
- `errors.ts` – shared error hierarchy for mandate flows
- `index.ts` – public exports for builders, utilities, and types

## Version

- **Current**: v1.0a
- **Status**: Stable
