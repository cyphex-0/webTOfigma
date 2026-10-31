# Security Policy

## 1. Supported Versions

We release security updates and bug fixes for the following version branch:

| Version | Supported | Status |
| :--- | :---: | :--- |
| **0.1.x** | :white_check_mark: | Current Active Release |
| **< 0.1.0** | :x: | Pre-release Development |

---

## 2. Reporting a Vulnerability

The Web-to-Figma engineering team takes the security of our users and their data seriously. If you discover a security vulnerability, we appreciate your help in disclosing it to us responsibly.

### How to Report
Please **DO NOT** create a public GitHub issue for security vulnerabilities. Instead, report security issues through one of the following channels:

- **Email:** `security@webtofigma.local`
- **GitHub Security Advisory:** Submit a private vulnerability report via [GitHub Security Advisories](https://github.com/cyphex-0/webTOfigma/security/advisories/new).

### What to Include
To help us triage and resolve your report quickly, please include:
1. A clear description of the vulnerability and its potential impact.
2. Step-by-step reproduction instructions or a minimal proof of concept (PoC).
3. The affected browser(s) and version(s) (e.g. Chrome 131, Edge 131, Brave, Firefox 132).
4. Operating system details (Windows, macOS, Linux).

---

## 3. Vulnerability Handling & Response Process

1. **Initial Acknowledgment:** We will acknowledge receipt of your report within **48 hours**.
2. **Triage & Assessment:** We will investigate, verify the vulnerability, and assign a CVSS severity rating within **5 business days**.
3. **Patch Development:** A fix will be developed, reviewed, and tested against our automated test matrix in an isolated branch.
4. **Coordinated Disclosure:** We will release a patch release (e.g. v0.1.1) and publish a security advisory acknowledging your contribution (unless you prefer to remain anonymous).
