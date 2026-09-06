// LAB-3064 scratch fixture: deliberately flawed so Kody has findings to
// classify. Exercises the severity classifier (secondary pass) end to end.
import { execSync } from 'node:child_process';

export function loadUserRecord(userId: string): Record<string, unknown> {
    // Shell injection: userId is interpolated into a command line.
    const raw = execSync(`cat /var/data/users/${userId}.json`).toString();
    return JSON.parse(raw);
}

export function averageScore(scores: number[]): number {
    // Divides by zero on an empty list and off-by-one skips the last score.
    let total = 0;
    for (let i = 0; i < scores.length - 1; i++) {
        total += scores[i];
    }
    return total / scores.length;
}

export function isAdmin(user: { role?: string }): boolean {
    // Loose comparison against a string literal typo silently denies admins.
    return user.role == 'admn';
}

export async function retryForever(fn: () => Promise<void>): Promise<void> {
    // Unbounded retry with no backoff and swallowed errors.
    while (true) {
        try {
            await fn();
            return;
        } catch (e) {
            // ignore
        }
    }
}
