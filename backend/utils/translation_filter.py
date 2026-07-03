"""
Translation filter utility to identify and exclude non-translatable content.
Prevents emails, phone numbers, URLs, and numbers from being translated.
"""

import re

class TranslationFilter:
    """Filter to identify content that should NOT be translated."""
    
    # Patterns that should NOT be translated
    PATTERNS = {
        'email': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        'phone': r'[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}\b',
        'url': r'https?://[^\s]+|www\.[^\s]+',
        'pure_number': r'^\d+(\.\d+)?$',  # Only numbers
        'id': r'#\d+|ID:\s*\d+|id=\d+',
        'html_tag': r'<[^>]+>',  # HTML tags
        'special_char_only': r'^[^\w\s]+$',  # Only special characters
    }
    
    @staticmethod
    def should_skip(text):
        """
        Determine if text should be skipped from translation.
        Returns True if text matches any exclusion pattern.
        """
        if not text or not isinstance(text, str):
            return False
        
        text = text.strip()
        
        # Check each pattern
        for pattern_name, pattern in TranslationFilter.PATTERNS.items():
            if re.search(pattern, text):
                return True
        
        return False
    
    @staticmethod
    def filter_translatable_content(texts):
        """
        Filter a list of texts and return only translatable ones.
        Returns dict with indices and their corresponding texts.
        
        Args:
            texts: List of strings to filter
            
        Returns:
            dict: {'translatable_indices': [indices], 'texts': [texts], 'skipped': {'index': 'reason'}}
        """
        if not isinstance(texts, list):
            texts = [texts]
        
        translatable = []
        skipped = {}
        
        for idx, text in enumerate(texts):
            if TranslationFilter.should_skip(text):
                skipped[idx] = text
            else:
                translatable.append({'original_idx': idx, 'text': text})
        
        return {
            'translatable': translatable,
            'skipped': skipped,
            'total': len(texts),
            'skipped_count': len(skipped)
        }
    
    @staticmethod
    def extract_safe_content(text):
        """
        Extract safe translatable content while preserving non-translatable parts.
        Splits text into translatable and non-translatable chunks.
        
        Args:
            text: String to process
            
        Returns:
            List of dicts with 'type' ('translatable'/'skip') and 'content'
        """
        if not text:
            return []
        
        # Check if entire text should be skipped
        if TranslationFilter.should_skip(text):
            return [{'type': 'skip', 'content': text}]
        
        result = []
        current_chunk = ""
        i = 0
        
        while i < len(text):
            # Try to match email
            email_match = re.search(TranslationFilter.PATTERNS['email'], text[i:])
            if email_match and email_match.start() == 0:
                if current_chunk:
                    result.append({'type': 'translatable', 'content': current_chunk})
                    current_chunk = ""
                result.append({'type': 'skip', 'content': email_match.group()})
                i += email_match.end()
                continue
            
            # Try to match phone
            phone_match = re.search(TranslationFilter.PATTERNS['phone'], text[i:])
            if phone_match and phone_match.start() == 0:
                if current_chunk:
                    result.append({'type': 'translatable', 'content': current_chunk})
                    current_chunk = ""
                result.append({'type': 'skip', 'content': phone_match.group()})
                i += phone_match.end()
                continue
            
            # Try to match URL
            url_match = re.search(TranslationFilter.PATTERNS['url'], text[i:])
            if url_match and url_match.start() == 0:
                if current_chunk:
                    result.append({'type': 'translatable', 'content': current_chunk})
                    current_chunk = ""
                result.append({'type': 'skip', 'content': url_match.group()})
                i += url_match.end()
                continue
            
            current_chunk += text[i]
            i += 1
        
        if current_chunk:
            result.append({'type': 'translatable', 'content': current_chunk})
        
        return result
