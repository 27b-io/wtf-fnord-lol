//! LAB-2219 probe (a): Rust `#[test]` asserts. Reproduces the shape Kody flagged
//! on anthropic-lb#161 `src/tests.rs` (assert_eq! / assert! inside a test fn).
//! Expected after the rule is scoped to `**/*.py`: ZERO findings from
//! "Don't Use `assert` for Data Validation" on this file.

fn headroom(limit: u32, used: u32) -> u32 {
    limit.saturating_sub(used)
}

#[cfg(test)]
mod tests {
    use super::headroom;

    #[test]
    fn headroom_saturates_at_zero() {
        assert_eq!(headroom(10, 4), 6);
        assert_eq!(headroom(4, 10), 0);
        assert!(headroom(0, 0) == 0);
    }

    #[test]
    fn headroom_is_monotonic_in_used() {
        assert!(headroom(10, 1) >= headroom(10, 2));
    }
}
