#!/usr/bin/env python3
"""
CI/CD Security Check for Plaintext Secrets.

This script scans for potential plaintext secrets in the codebase and fails
if any are found. Intended for use in CI/CD pipelines.

Detection Patterns:
- API keys (sk-, pk-, etc.)
- Tokens (bearer, basic auth)
- Passwords in configuration
- Secret strings in code
- Hardcoded credentials

Usage:
    python security/check_secrets.py --path . --fail-on-error

Exit Codes:
    0: No secrets found (success)
    1: Secrets found (failure)
    2: Error running check
"""

import argparse
import base64
import hashlib
import json
import logging
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import List, Dict, Optional, Pattern


# =============================================================================
# Severity Levels
# =============================================================================


class Severity(str, Enum):
    """Severity of secret detection."""

    CRITICAL = "critical"  # Definitely a secret
    HIGH = "high"  # Likely a secret
    MEDIUM = "medium"  # Could be a secret
    LOW = "low"  # Might be a secret


# =============================================================================
# Detection Patterns
# =============================================================================


# Regex patterns for secret detection
SECRET_PATTERNS = [
    # API Keys
    (r"sk-[a-zA-Z0-9]{20,}", Severity.CRITICAL, "Anthropic API Key"),
    (r"sk-[a-zA-Z0-9]{32,}", Severity.CRITICAL, "OpenAI API Key"),
    (r"AIza[a-zA-Z0-9_\-]{35}", Severity.CRITICAL, "Google API Key"),
    (r"AKIA[0-9A-Z]{16}", Severity.CRITICAL, "AWS Access Key"),
    (r"[0-9a-zA-Z/+]{40}", Severity.HIGH, "Generic API Key"),

    # Tokens
    (r"Bearer [a-zA-Z0-9_\-\.]{20,}", Severity.CRITICAL, "Bearer Token"),
    (r"Basic [a-zA-Z0-9+/=]{20,}", Severity.HIGH, "Basic Auth"),
    (r"ghp_[a-zA-Z0-9]{36}", Severity.CRITICAL, "GitHub Personal Access Token"),
    (r"gho_[a-zA-Z0-9]{36}", Severity.CRITICAL, "GitHub OAuth Token"),
    (r"ghu_[a-zA-Z0-9]{36}", Severity.CRITICAL, "GitHub User Token"),
    (r"ghs_[a-zA-Z0-9]{36}", Severity.CRITICAL, "GitHub Server Token"),
    (r"ghr_[a-zA-Z0-9]{36}", Severity.CRITICAL, "GitHub Refresh Token"),
    (r"glpat-[a-zA-Z0-9_\-]{20}", Severity.CRITICAL, "GitLab Token"),

    # Database URLs
    (r"postgres://[a-zA-Z0-9_\-:]+@[a-zA-Z0-9._\-]+", Severity.CRITICAL, "PostgreSQL URL"),
    (r"mysql://[a-zA-Z0-9_\-:]+@[a-zA-Z0-9._\-]+", Severity.CRITICAL, "MySQL URL"),
    (r"redis://[a-zA-Z0-9_\-:]+@[a-zA-Z0-9._\-]+", Severity.HIGH, "Redis URL"),
    (r"mongodb://[a-zA-Z0-9_\-:]+@[a-zA-Z0-9._\-]+", Severity.HIGH, "MongoDB URL"),

    # JWT
    (r"eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+", Severity.HIGH, "JWT Token"),

    # AWS credentials
    (r"AWS[a-zA-Z0-9]{20}", Severity.CRITICAL, "AWS Session Token"),

    # Password fields
    (r'"password":\s*"[^"]{8,}"', Severity.HIGH, "Password in JSON"),
    (r"'password':\s*'[^']{8,}'", Severity.HIGH, "Password in JSON"),
    (r"password\s*=\s*['\"][^'\"]{8,}['\"]", Severity.HIGH, "Password in config"),

    # Private keys (base64-like)
    (r"[a-zA-Z0-9+/]{40,}={0,2}", Severity.MEDIUM, "Base64 Encoded Secret"),
]

# Additional context-based patterns
CONTEXT_PATTERNS = [
    # Common secret variable names
    (r"\b(api_key|apikey|api-key|secret_key|secretkey|secret-key|access_key|access-key|auth_token|authtoken|auth-token)\b",
     Severity.HIGH, "Secret Variable Name"),

    # File extensions that shouldn't be committed
    (r"\.(pem|key|p12|pfx|jks|keystore)$", Severity.HIGH, "Certificate/Private Key File"),
]


# =============================================================================
# Data Models
# =============================================================================


@dataclass
class SecretFinding:
    """A detected secret."""

    file: str
    line: int
    column: int
    pattern: str
    pattern_name: str
    severity: Severity
    matched_text: str
    context: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "file": self.file,
            "line": self.line,
            "column": self.column,
            "pattern": self.pattern,
            "pattern_name": self.pattern_name,
            "severity": self.severity.value,
            "matched_text": self.matched_text[:50] + "..." if len(self.matched_text) > 50 else self.matched_text,
        }


@dataclass
class ScanResult:
    """Result of a secrets scan."""

    path: str
    findings: List[SecretFinding] = field(default_factory=list)
    files_scanned: int = 0
    errors: List[str] = field(default_factory=list)
    start_time: datetime = None
    end_time: Optional[datetime] = None

    @property
    def has_critical(self) -> bool:
        """Check if any critical findings."""
        return any(f.severity == Severity.CRITICAL for f in self.findings)

    @property
    def total_by_severity(self) -> Dict[str, int]:
        """Count findings by severity."""
        counts = {s.value: 0 for s in Severity}
        for finding in self.findings:
            counts[finding.severity.value] += 1
        return counts

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "path": self.path,
            "files_scanned": self.files_scanned,
            "findings": [f.to_dict() for f in self.findings],
            "findings_by_severity": self.total_by_severity,
            "errors": self.errors,
        }


# =============================================================================
# Scanner
# =============================================================================


class SecretScanner:
    """
    Scanner for detecting plaintext secrets in code.

    Features:
    - Regex-based pattern matching
    - Context-aware detection
    - Configurable severity thresholds
    - SARIF output format
    - Exclusion patterns
    """

    def __init__(
        self,
        fail_on_severity: Severity = Severity.MEDIUM,
        exclude_patterns: Optional[List[str]] = None,
    ):
        """
        Initialize scanner.

        Args:
            fail_on_severity: Minimum severity to fail on
            exclude_patterns: Regex patterns to exclude
        """
        self.fail_on_severity = fail_on_severity
        self.exclude_patterns = [
            re.compile(p) for p in (exclude_patterns or [])
        ]

        # Compile detection patterns
        self.patterns = []
        for pattern, severity, name in SECRET_PATTERNS:
            self.patterns.append((re.compile(pattern), severity, name))

        for pattern, severity, name in CONTEXT_PATTERNS:
            self.patterns.append((re.compile(pattern, re.IGNORECASE), severity, name))

    def scan_path(self, path: str) -> ScanResult:
        """
        Scan a path for secrets.

        Args:
            path: Path to scan (file or directory)

        Returns:
            ScanResult with findings
        """
        result = ScanResult(
            path=path,
            start_time=datetime.now(),
        )

        scan_path = Path(path)

        if not scan_path.exists():
            result.errors.append(f"Path '{path}' does not exist")
            result.end_time = datetime.now()
            return result

        if scan_path.is_file():
            files = [scan_path]
        else:
            files = [
                f for f in scan_path.rglob("*")
                if f.is_file() and not self._is_excluded(f)
            ]

        for file_path in files:
            try:
                findings = self._scan_file(file_path)
                result.findings.extend(findings)
                result.files_scanned += 1
            except Exception as e:
                result.errors.append(f"Error scanning '{file_path}': {e}")

        result.end_time = datetime.now()
        return result

    def _is_excluded(self, path: Path) -> bool:
        """Check if path should be excluded."""
        # Common exclusions
        exclusions = [
            "node_modules",
            ".git",
            "venv",
            ".venv",
            "__pycache__",
            ".pytest_cache",
            "dist",
            "build",
            "*.min.js",
            "*.min.css",
            "package-lock.json",
            "yarn.lock",
            "test_*.py",  # Test files with sample data
        ]

        # Check against exclusion patterns
        for pattern in self.exclude_patterns:
            if pattern.search(str(path)):
                return True

        # Check against built-in exclusions
        path_str = str(path)
        for exclusion in exclusions:
            if exclusion in path_str:
                return True

        return False

    def _scan_file(self, file_path: Path) -> List[SecretFinding]:
        """Scan a single file for secrets."""
        findings = []

        # Skip binary files
        if self._is_binary(file_path):
            return findings

        try:
            content = file_path.read_text(encoding='utf-8', errors='ignore')
            lines = content.split('\n')
        except Exception:
            return findings

        for line_num, line in enumerate(lines, 1):
            for pattern, severity, name in self.patterns:
                matches = pattern.finditer(line)

                for match in matches:
                    # Get context
                    start = max(0, match.start() - 20)
                    end = min(len(line), match.end() + 20)
                    context = line[start:end]

                    findings.append(SecretFinding(
                        file=str(file_path),
                        line=line_num,
                        column=match.start() + 1,
                        pattern=pattern.pattern,
                        pattern_name=name,
                        severity=severity,
                        matched_text=match.group(),
                        context=context.strip(),
                    ))

        return findings

    def _is_binary(self, path: Path) -> bool:
        """Check if file is binary."""
        # Check extension
        binary_extensions = {
            ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico",
            ".pdf", ".zip", ".tar", ".gz", ".bz2",
            ".exe", ".dll", ".so", ".dylib",
            ".p12", ".pfx", ".jks", ".keystore",
        }

        if path.suffix.lower() in binary_extensions:
            return True

        # Check content
        try:
            with open(path, "rb") as f:
                chunk = f.read(1024)
                return b"\x00" in chunk
        except Exception:
            return True


# =============================================================================
# Output Formatters
# =============================================================================


class OutputFormatter:
    """Format scan results for different outputs."""

    @staticmethod
    def text(result: ScanResult) -> str:
        """Format as human-readable text."""
        lines = [
            f"Secret Scan Results for: {result.path}",
            f"Files Scanned: {result.files_scanned}",
            f"Findings: {len(result.findings)}",
            "",
        ]

        if result.findings:
            lines.extend(["Findings by Severity:", ""])

            for severity, count in result.total_by_severity.items():
                if count > 0:
                    lines.append(f"  {severity.upper()}: {count}")

            lines.append("")
            lines.append("Detailed Findings:")
            lines.append("-" * 60)

            for finding in sorted(result.findings, key=lambda f: (f.severity.value, f.file, f.line)):
                lines.extend([
                    f"  {finding.severity.value.upper()}: {finding.pattern_name}",
                    f"    File: {finding.file}:{finding.line}:{finding.column}",
                    f"    Pattern: {finding.pattern}",
                    f"    Match: {finding.matched_text[:100]}",
                    "",
                ])

        if result.errors:
            lines.extend(["", "Errors:", ""])
            for error in result.errors:
                lines.append(f"  - {error}")

        return "\n".join(lines)

    @staticmethod
    def sarif(result: ScanResult, tool_name: str = "check_secrets") -> str:
        """Format as SARIF (Static Analysis Results Interchange Format)."""
        # Build SARIF structure
        sarif = {
            "version": "2.1.0",
            "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
            "runs": [
                {
                    "tool": {
                        "driver": {
                            "name": tool_name,
                            "version": "1.0.0",
                            "informationUri": "https://github.com/your-org/security-tools",
                        }
                    },
                    "results": [
                        {
                            "ruleId": f"{finding.pattern_name}_{finding.severity.value}",
                            "level": finding.severity.value,
                            "message": {
                                "text": f"Potential {finding.pattern_name} detected",
                            },
                            "locations": [
                                {
                                    "physicalLocation": {
                                        "artifactLocation": {
                                            "uri": finding.file,
                                        },
                                        "region": {
                                            "startLine": finding.line,
                                            "startColumn": finding.column,
                                            "snippet": {
                                                "text": finding.context or "",
                                            },
                                        },
                                    },
                                }
                            ],
                        }
                        for finding in result.findings
                    ],
                }
            ],
        }

        return json.dumps(sarif, indent=2)

    @staticmethod
    def github_actions(result: ScanResult) -> str:
        """Format for GitHub Actions annotations."""
        lines = []

        for finding in result.findings:
            level = "error" if finding.severity == Severity.CRITICAL else "warning"
            lines.append(
                f"::{level} file={finding.file},line={finding.line},col={finding.column}"
                f"::{finding.pattern_name}"
            )

        return "\n".join(lines)


# =============================================================================
# CLI
# =============================================================================


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Scan for plaintext secrets in code"
    )

    parser.add_argument(
        "--path",
        type=str,
        default=".",
        help="Path to scan",
    )

    parser.add_argument(
        "--severity",
        choices=["critical", "high", "medium", "low"],
        default="medium",
        help="Minimum severity to report",
    )

    parser.add_argument(
        "--fail-on-error",
        action="store_true",
        help="Exit with error if secrets are found",
    )

    parser.add_argument(
        "--format",
        choices=["text", "sarif", "github"],
        default="text",
        help="Output format",
    )

    parser.add_argument(
        "--output",
        type=str,
        help="Write results to file",
    )

    parser.add_argument(
        "--exclude",
        type=str,
        action="append",
        help="Regex patterns to exclude",
    )

    args = parser.parse_args()

    # Run scan
    severity = Severity[args.severity.upper()]
    scanner = SecretScanner(fail_on_severity=severity, exclude_patterns=args.exclude)

    result = scanner.scan_path(args.path)

    # Format output
    formatter = OutputFormatter()

    if args.format == "text":
        output = formatter.text(result)
    elif args.format == "sarif":
        output = formatter.sarif(result)
    elif args.format == "github":
        output = f"{formatter.text(result)}\n\n{formatter.github_actions(result)}"

    # Write output
    if args.output:
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        Path(args.output).write_text(output)
    else:
        print(output)

    # Determine exit code
    if args.fail_on_error:
        # Check if findings meet severity threshold
        for finding in result.findings:
            if finding.severity.value <= args.severity:
                sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
