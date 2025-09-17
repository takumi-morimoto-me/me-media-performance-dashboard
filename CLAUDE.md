# Claude Development Guidelines

This document outlines the development guidelines and rules for Claude to follow when working on this project.

## 1. Core Principles

- **Strictly adhere to the design principles and rules outlined in `docs/デザイン定義書.md`.**
- **Before starting implementation, always check the relevant documents in the `docs` directory.**
- **If the plan or specifications change during implementation, update the relevant documents in the `docs` directory.**
- **Diagrams must be complete**: When creating diagrams (e.g., directory structures), they must be written out completely, showing all relevant files and directories without abbreviation.
- Adhere to the technical stack, directory structure, and all policies defined in this document.

## 2. Technology Stack

- **Frontend**: Next.js, React, Tailwind CSS, **shadcn/ui**
- **Backend & Infrastructure**: Firebase (Firestore, Storage, Authentication), Google Cloud (Cloud Run, Cloud Scheduler, Vertex AI, Secret Manager, Monitoring, Logging)
- **Testing**: Jest, React Testing Library, Playwright

## 3. Directory Structure

- `src/app/`: Pages and routing (following Next.js App Router conventions).
- `src/components/`: UI components, structured by Atomic Design (`atoms`, `molecules`, `organisms`).
- `src/features/`: Business logic for major features (e.g., data management, MCP).
- `src/lib/`: Firebase/GCP clients, and other low-level utility functions.
- `src/hooks/`: Custom React hooks.
- `src/types/`: TypeScript type definitions.
- `docs/`: Project documentation, including requirement definitions and design documents.

## 4. Branching Strategy

This project follows a Git-flow like branching model.

- **`main`**: Production-ready branch.
- **`develop`**: Main development branch.
- **`staging` / `release`**: Pre-release testing branch.

## 5. Pre-deployment Checklist

Before merging to `main`, ensure the following checks pass:

1.  `pnpm lint`: No linting errors.
2.  `pnpm type-check`: No TypeScript type errors.
3.  `pnpm test`: All tests pass.
4.  `pnpm build`: The project builds successfully.

## 6. UI Development

- **Prioritize `shadcn/ui`**: When implementing UI components, first check if a suitable component is available from [shadcn/ui](https://ui.shadcn.com/).
- This project adopts **Atomic Design** for UI components.

## 7. Language

- **Communication**: Japanese

## 8. Commit Messages

- **Language**: English
- **Format**: [Conventional Commits](https://www.conventionalcommits.org/)

## 9. Package Manager

- **Tool**: `pnpm`

## 10. Testing Policy

- **Unit/Integration Tests**: Use `Jest` and `React Testing Library`.
- **E2E & Browser Automation**: Use `Playwright`.

## 11. Claude-Specific Guidelines

- **Always run linting and type checking**: After implementing changes, run `pnpm lint` and `pnpm type-check` to ensure code quality.
- **Follow existing patterns**: Before creating new components or features, examine existing code to understand patterns and conventions.
- **Use available tools**: Leverage Claude Code's tools for file reading, searching, and editing to understand the codebase thoroughly.
- **Test implementations**: When possible, run tests to verify functionality with `pnpm test`.

## 12. ESLint Rules and Guidelines

- **Prefer const over let**: Use `const` for variables that are never reassigned. ESLint will enforce `prefer-const` rule.
- **React Hooks dependencies**: Always include all dependencies in useEffect and useCallback hooks. Use `useCallback` for functions that are used as dependencies.
- **Unused imports**: Remove unused imports to keep code clean. Comment out unused imports in development files like Firebase functions if they will be used later.
- **require() imports**: In configuration files like `tailwind.config.ts`, use `// eslint-disable-line @typescript-eslint/no-require-imports` to allow necessary require() statements.
- **TypeScript strict rules**: Follow TypeScript strict mode rules including no unused variables and proper type annotations.