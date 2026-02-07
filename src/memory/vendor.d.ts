declare module "@xenova/transformers" {
    export function pipeline(
        task: string,
        model: string,
        opts?: { quantized?: boolean },
    ): Promise<{
        (input: string, opts?: { pooling?: string; normalize?: boolean }): Promise<{ data: Float32Array }>;
    }>;
}
