"""
Prompt templates for Sirchmunk search system.

Contains prompts for keyword extraction, evidence evaluation,
result summarization, and other LLM-powered operations.
"""

# Fast query analysis prompt for extracting search terms
FAST_QUERY_ANALYSIS = """Extract search terms at two granularity levels from the user query for a ripgrep file search. Both levels in one response.

### User Query
{user_input}

### Output
Return JSON only, no extra text:
{{"primary": ["compound phrase"], "fallback": ["term1", "term2"], "file_hints": [], "intent": "..."}}

Rules:
- **primary**: 1 compound phrase (2-3 words) that is the most discriminating and likely to appear **verbatim** in the target document. This is tried first.
- **fallback**: 1-3 single-word atomic terms decomposed from the primary phrase. These are tried only if primary misses. Pick the most specific word(s), not generic ones.
- **file_hints**: filename fragments or glob patterns ONLY if clearly implied; empty array otherwise.
- **intent**: one sentence.

Example: query "How does transformer attention work?"
→ {{"primary": ["transformer attention"], "fallback": ["attention", "transformer"], "file_hints": [], "intent": "understand transformer attention mechanism"}}
"""

# Search result summary prompt
SEARCH_RESULT_SUMMARY = """
### Task
Analyze the provided {text_content} and generate a concise summary in the form of a Markdown Briefing.

### Constraints
1. **Language Continuity**: The output must be in the SAME language as the User Input.
2. **Format**: Use Markdown (headings, bullet points, and bold text) for high readability.
3. **Style**: Keep it professional, objective, and clear. Avoid fluff.

### Input Data
- **User Input**: {user_input}
- **Search Result Text**: {text_content}

### Quality Evaluation
After generating the summary, evaluate whether this knowledge cluster is worth saving to the persistent cache based on:
1. Does the search result contain substantial, relevant information for the user input?
2. Is the content meaningful and not just error messages or "no information found"?
3. Are there sufficient evidences and context to answer the user's query?

If YES to all above, output "true"; otherwise output "false".

### Output Format
<SUMMARY>
[Generate the Markdown Briefing here]
</SUMMARY>
<SHOULD_SAVE>true/false</SHOULD_SAVE>
"""

# ROI (Return on Investment) result summary - simpler version without save decision
ROI_RESULT_SUMMARY = """
### Task
Analyze the provided {text_content} and generate a concise summary in the form of a Markdown Briefing.

### Constraints
1. **Language Continuity**: The output must be in the SAME language as the User Input.
2. **Format**: Use Markdown (headings, bullet points, and bold text) for high readability.
3. **Style**: Keep it professional, objective, and clear. Avoid fluff.

### Input Data
- **User Input**: {user_input}
- **Search Result Text**: {text_content}

### Output
[Generate the Markdown Briefing here]
"""

# Evidence synthesis prompt
EVIDENCE_SUMMARY = """
## Role: High-Precision Information Synthesis Expert

## Task:
Synthesize a structured response based on the User Input and the provided Evidences.

### Critical Constraint:
1. **Language Consistency:** All output fields (<DESCRIPTION>, <NAME>, and <CONTENT>) MUST be written in the **same language** as the User Input.
2. **Ignore irrelevant noise:** Focus exclusively on information that directly relates to the User Input. If evidences contain conflicting or redundant data, prioritize accuracy and relevance.

### Input Data:
- **User Input:** {user_input}
- **Retrieved Evidences:** {evidences}

### Output Instructions:
1. **<DESCRIPTION>**: A high-level, concise synthesis of how the evidences address the user input.
   - *Constraint:* Maximum 3 sentences. Written in the language of {user_input}.
2. **<NAME>**: A ultra-short, catchy title or identifier for the description.
   - *Constraint:* Exactly 1 sentence, maximum 30 characters. Written in the language of {user_input}.
3. **<CONTENT>**: A detailed and comprehensive summary of all relevant key points extracted from the evidences.
   - *Constraint:* Written in the language of {user_input}.

### Output Format:
<DESCRIPTION>[Concise synthesis]</DESCRIPTION>
<NAME>[Short title]</NAME>
<CONTENT>[Detailed summary]</CONTENT>
"""

# Evidence evaluation prompt for Monte Carlo sampling
EVALUATE_EVIDENCE_SAMPLE = """
You are a document retrieval assistant. Please evaluate if the text snippet contains clues to answer the user's question.

### Language Constraint:
Detect the language of the "Query" and provide the "reasoning" and "output" in the same language (e.g., if the query is in Chinese, the reasoning must be in Chinese).

### Inputs:
Query: "{query}"

Text Snippet (Source: {sample_source}):
"...{sample_content}..."

### Output Requirement:
Return JSON:
- score (0-10):
  0-3: Completely irrelevant.
  4-7: Contains relevant keywords or context but no direct answer.
  8-10: Contains exact data, facts, or direct answer.
- reasoning: Short reasoning in the SAME language as the query.

JSON format only.
"""

# Multi-level keyword extraction prompt template
QUERY_KEYWORDS_EXTRACTION = """
### Role: Search Optimization Expert & Information Retrieval Specialist

### Task:
Extract **{num_levels} sets** of keywords from the user query with **different granularities** to maximize search hit rate.

### Multi-Level Keyword Granularity Strategy:

Extract {num_levels} levels of keywords with progressively finer granularity:

{level_descriptions}

### IDF Value Guidelines:
- Estimate the **IDF (Inverse Document Frequency)** for each keyword based on its rarity in general corpus
- IDF range: **[0-10]** where:
  - 0-3: Very common terms (e.g., "the", "is", "data")
  - 4-6: Moderately common terms (e.g., "algorithm", "network")
  - 7-9: Rare/specific terms (e.g., "backpropagation", "xgboost")
  - 10: Extremely rare/specialized terms
- IDF values are **independent** of keyword level - focus on term rarity, not granularity

### Requirements:
- Each level should have 3-5 keywords
- Keywords must become progressively **finer-grained** from Level 1 to Level {num_levels}
- **Level 1**: Coarse-grained phrases/multi-word expressions
- **Level {num_levels}**: Fine-grained single words or precise technical terms
- ONLY extract from the user query context; do NOT add external information
- Ensure keywords at different levels are complementary, not redundant

### Output Format:
Output {num_levels} separate JSON-like dicts within their respective tags:

{output_format_example}

### User Query:
{{user_input}}

### {num_levels}-Level Keywords (Coarse to Fine):
"""


def generate_keyword_extraction_prompt(num_levels: int = 3) -> str:
    """
    Generate a dynamic keyword extraction prompt template.
    
    Args:
        num_levels: Number of granularity levels (default: 3)
    
    Returns:
        Prompt template string with {{user_input}} placeholder
    """
    level_descriptions = []
    for i in range(1, num_levels + 1):
        if i == 1:
            granularity = "Coarse-grained"
            desc_text = "Multi-word phrases, compound expressions, broader concepts"
            examples = '"machine learning algorithms", "data processing pipeline"'
        elif i == num_levels:
            granularity = "Fine-grained"
            desc_text = "Single words, precise terms, atomic concepts"
            examples = '"optimization", "gradient", "tensor", "epoch"'
        else:
            granularity = f"Medium-grained (Level {i})"
            desc_text = "2-3 word phrases or compound terms transitioning to single words"
            examples = '"deep learning", "batch normalization", "learning rate"'
        
        level_descriptions.append(
            f"**Level {i}** ({granularity}):\n"
            f"   - Granularity: {desc_text}\n"
            f"   - Example keywords: {examples}\n"
            f"   - Note: IDF values should reflect term rarity, not granularity level"
        )
    
    output_examples = []
    for i in range(1, num_levels + 1):
        example_dict = '{{"keyword1": idf_value, "keyword2": idf_value, ...}}'
        output_examples.append(
            f"<KEYWORDS_LEVEL_{i}>\n{example_dict}\n</KEYWORDS_LEVEL_{i}>"
        )
    
    return QUERY_KEYWORDS_EXTRACTION.format(
        num_levels=num_levels,
        level_descriptions="\n\n".join(level_descriptions),
        output_format_example="\n\n".join(output_examples)
    )
