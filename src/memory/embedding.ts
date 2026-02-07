/// <reference path="./vendor.d.ts" />
import { pipeline } from "@xenova/transformers";

/** 多语言小模型，中英文表现较好，适合语义检索 */
const MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

let embedder: Awaited<ReturnType<typeof pipeline>> | null = null;

export async function getEmbedder() {
    if (!embedder) {
        embedder = await pipeline("feature-extraction", MODEL, { quantized: true });
    }
    return embedder;
}

/**
 * 对单条文本做 embedding，mean pooling + L2 归一化
 */
export async function embed(text: string): Promise<number[]> {
    const ext = await getEmbedder();
    const out = await ext(text, {
        pooling: "mean",
        normalize: true,
    });
    return Array.from(out.data as Float32Array);
}
