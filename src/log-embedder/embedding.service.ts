import { OpenAIEmbeddings } from '@langchain/openai';

export class EmbeddingService {
  private readonly embeddings: OpenAIEmbeddings;

  constructor(apiKey: string, model: string) {
    this.embeddings = new OpenAIEmbeddings({
      apiKey,
      model,
      dimensions: 768,
    });
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    return this.embeddings.embedDocuments(texts);
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.embeddings.embedQuery(text);
  }
}
