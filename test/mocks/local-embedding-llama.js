/**
 * Jest mock for local-embedding-llama to avoid compiling import.meta in test env.
 */
function getLocalEmbeddingLlamaUnavailableReason() {
    return null;
}
async function getLocalEmbeddingLlamaProvider() {
    return null;
}
module.exports = { getLocalEmbeddingLlamaUnavailableReason, getLocalEmbeddingLlamaProvider };
