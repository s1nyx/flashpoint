/**
 * @interface UseCase
 * @description Base interface for all use cases following clean architecture
 */
export interface UseCase<TInput, TOutput> {
    execute(input: TInput): Promise<TOutput>;
}