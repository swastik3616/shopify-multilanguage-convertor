export const TranslationFilterUtils = {
  patterns: {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}\b/g,
    url: /https?:\/\/[^\s]+|www\.[^\s]+/g,
    pureNumber: /^\d+(\.\d+)?$/,
    id: /#\d+|ID:\s*\d+|id=\d+/g,
    htmlTag: /<[^>]+>/g,
    specialCharOnly: /^[^\w\s]+$/,
  },

  /**
   * Check if a text should be skipped from translation
   * @param {string} text - Text to check
   * @returns {boolean} - True if text should be skipped
   */
  shouldSkip(text) {
    if (!text || typeof text !== 'string') return false;

    text = text.trim();

    // Check email
    if (this.patterns.email.test(text)) {
      this.patterns.email.lastIndex = 0; // Reset regex state
      return true;
    }

    // Check phone
    if (this.patterns.phone.test(text)) {
      this.patterns.phone.lastIndex = 0;
      return true;
    }

    // Check URL
    if (this.patterns.url.test(text)) {
      this.patterns.url.lastIndex = 0;
      return true;
    }

    // Check pure number
    if (this.patterns.pureNumber.test(text)) return true;

    // Check ID pattern
    if (this.patterns.id.test(text)) {
      this.patterns.id.lastIndex = 0;
      return true;
    }

    // Check HTML tag
    if (this.patterns.htmlTag.test(text)) {
      this.patterns.htmlTag.lastIndex = 0;
      return true;
    }

    // Check special characters only
    if (this.patterns.specialCharOnly.test(text)) return true;

    return false;
  },

  /**
   * Filter an array of texts and return only translatable ones
   * @param {Array<string>} texts - Array of texts to filter
   * @returns {Object} - {translatable: Array, skipped: Object, count: Object}
   */
  filterTranslatableContent(texts) {
    if (!Array.isArray(texts)) texts = [texts];

    const translatable = [];
    const skipped = {};

    texts.forEach((text, idx) => {
      if (this.shouldSkip(text)) {
        skipped[idx] = text;
      } else {
        translatable.push({ originalIdx: idx, text });
      }
    });

    return {
      translatable,
      skipped,
      total: texts.length,
      skippedCount: Object.keys(skipped).length,
    };
  },

  /**
   * Extract translatable content while preserving non-translatable parts
   * @param {string} text - Text to process
   * @returns {Array} - Array of {type: 'translatable'|'skip', content: string}
   */
  extractSafeContent(text) {
    if (!text) return [];

    if (this.shouldSkip(text)) {
      return [{ type: 'skip', content: text }];
    }

    const result = [];
    let currentChunk = '';
    let i = 0;

    while (i < text.length) {
      // Try to match email
      const emailMatch = text.substring(i).match(this.patterns.email);
      if (emailMatch && emailMatch.index === 0) {
        if (currentChunk) {
          result.push({ type: 'translatable', content: currentChunk });
          currentChunk = '';
        }
        result.push({ type: 'skip', content: emailMatch[0] });
        i += emailMatch[0].length;
        this.patterns.email.lastIndex = 0;
        continue;
      }

      // Try to match phone
      const phoneMatch = text.substring(i).match(this.patterns.phone);
      if (phoneMatch && phoneMatch.index === 0) {
        if (currentChunk) {
          result.push({ type: 'translatable', content: currentChunk });
          currentChunk = '';
        }
        result.push({ type: 'skip', content: phoneMatch[0] });
        i += phoneMatch[0].length;
        this.patterns.phone.lastIndex = 0;
        continue;
      }

      // Try to match URL
      const urlMatch = text.substring(i).match(this.patterns.url);
      if (urlMatch && urlMatch.index === 0) {
        if (currentChunk) {
          result.push({ type: 'translatable', content: currentChunk });
          currentChunk = '';
        }
        result.push({ type: 'skip', content: urlMatch[0] });
        i += urlMatch[0].length;
        this.patterns.url.lastIndex = 0;
        continue;
      }

      currentChunk += text[i];
      i += 1;
    }

    if (currentChunk) {
      result.push({ type: 'translatable', content: currentChunk });
    }

    return result;
  },

  /**
   * Reconstruct text from extracted content chunks
   * @param {Array} chunks - Array of {type, content}
   * @param {string} translatedText - Translated content (for translatable parts)
   * @returns {string} - Reconstructed text
   */
  reconstructContent(chunks, translatedText) {
    const translatableChunks = chunks
      .filter(c => c.type === 'translatable')
      .map(c => c.content);

    if (translatableChunks.length === 0) return translatedText;

    const translatableParts = translatedText.split('\n');
    let resultIndex = 0;

    return chunks
      .map(chunk => {
        if (chunk.type === 'skip') return chunk.content;
        return translatableParts[resultIndex++] || chunk.content;
      })
      .join('');
  },
};

export default TranslationFilterUtils;
