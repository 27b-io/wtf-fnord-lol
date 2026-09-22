// LAB-4551 scratch PR — POSITIVE case: test fixtures that should NOT fire
// These are the exact patterns from the documented false positives on #193 and #179

#[cfg(test)]
mod tests {
    // Test fixture: Anthropic test token (10 chars after prefix, below .gitleaks.toml 20-char threshold)
    const TEST_TOKEN: &str = "sk-ant-oat01-test-token";

    // Test fixture: AWS published documentation example key
    // Source: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html
    const AWS_DOCS_EXAMPLE_SECRET_KEY: &str = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
    const AWS_DOCS_EXAMPLE_ACCESS_KEY: &str = "AKIAIOSFODNN7EXAMPLE";

    #[test]
    fn test_uses_fixtures() {
        assert!(!TEST_TOKEN.is_empty());
        assert!(!AWS_DOCS_EXAMPLE_SECRET_KEY.is_empty());
        assert!(!AWS_DOCS_EXAMPLE_ACCESS_KEY.is_empty());
    }
}
