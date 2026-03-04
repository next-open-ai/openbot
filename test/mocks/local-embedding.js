/**
 * Jest mock for local-embedding to avoid loading local-embedding-llama (import.meta in test).
 */
function getLocalEmbeddingUnavailableReason() {
    return null;
}
async function getLocalEmbeddingProvider() {
    return null;
}
module.exports = { getLocalEmbeddingProvider, getLocalEmbeddingUnavailableReason };
