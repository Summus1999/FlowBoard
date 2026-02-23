/**
 * 编程语言配置
 * 支持多种编程语言，包括 Monaco Editor 语言和 LeetCode 语言映射
 */

const LanguageConfig = {
    // 语言定义
    languages: {
        javascript: {
            name: 'JavaScript',
            monacoId: 'javascript',
            leetCodeId: 'javascript',
            fileExtension: 'js',
            icon: 'fab fa-js',
            template: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
var twoSum = function(nums, target) {
    // 在此编写你的代码
    
};`
        },
        typescript: {
            name: 'TypeScript',
            monacoId: 'typescript',
            leetCodeId: 'typescript',
            fileExtension: 'ts',
            icon: 'fab fa-js-square',
            template: `function twoSum(nums: number[], target: number): number[] {
    // 在此编写你的代码
    
};`
        },
        python: {
            name: 'Python',
            monacoId: 'python',
            leetCodeId: 'python3',
            fileExtension: 'py',
            icon: 'fab fa-python',
            template: `class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        # 在此编写你的代码
        pass`
        },
        java: {
            name: 'Java',
            monacoId: 'java',
            leetCodeId: 'java',
            fileExtension: 'java',
            icon: 'fab fa-java',
            template: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        // 在此编写你的代码
        return new int[0];
    }
}`
        },
        cpp: {
            name: 'C++',
            monacoId: 'cpp',
            leetCodeId: 'cpp',
            fileExtension: 'cpp',
            icon: 'fas fa-code',
            template: `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        // 在此编写你的代码
        return {};
    }
};`
        },
        c: {
            name: 'C',
            monacoId: 'c',
            leetCodeId: 'c',
            fileExtension: 'c',
            icon: 'fas fa-code',
            template: `int* twoSum(int* nums, int numsSize, int target, int* returnSize) {
    // 在此编写你的代码
    
}`
        },
        csharp: {
            name: 'C#',
            monacoId: 'csharp',
            leetCodeId: 'csharp',
            fileExtension: 'cs',
            icon: 'fab fa-microsoft',
            template: `public class Solution {
    public int[] TwoSum(int[] nums, int target) {
        // 在此编写你的代码
        return new int[0];
    }
}`
        },
        go: {
            name: 'Go',
            monacoId: 'go',
            leetCodeId: 'golang',
            fileExtension: 'go',
            icon: 'fab fa-google',
            template: `func twoSum(nums []int, target int) []int {
    // 在此编写你的代码
    
}`
        },
        rust: {
            name: 'Rust',
            monacoId: 'rust',
            leetCodeId: 'rust',
            fileExtension: 'rs',
            icon: 'fab fa-rust',
            template: `impl Solution {
    pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {
        // 在此编写你的代码
        
    }
}`
        },
        kotlin: {
            name: 'Kotlin',
            monacoId: 'kotlin',
            leetCodeId: 'kotlin',
            fileExtension: 'kt',
            icon: 'fab fa-android',
            template: `class Solution {
    fun twoSum(nums: IntArray, target: Int): IntArray {
        // 在此编写你的代码
        
    }
}`
        },
        swift: {
            name: 'Swift',
            monacoId: 'swift',
            leetCodeId: 'swift',
            fileExtension: 'swift',
            icon: 'fab fa-apple',
            template: `class Solution {
    func twoSum(_ nums: [Int], _ target: Int) -> [Int] {
        // 在此编写你的代码
        
    }
}`
        },
        php: {
            name: 'PHP',
            monacoId: 'php',
            leetCodeId: 'php',
            fileExtension: 'php',
            icon: 'fab fa-php',
            template: `class Solution {
    function twoSum($nums, $target) {
        // 在此编写你的代码
        
    }
}`
        },
        ruby: {
            name: 'Ruby',
            monacoId: 'ruby',
            leetCodeId: 'ruby',
            fileExtension: 'rb',
            icon: 'fas fa-gem',
            template: `# @param {Integer[]} nums
# @param {Integer} target
# @return {Integer[]}
def two_sum(nums, target)
    # 在此编写你的代码
    
end`
        },
        scala: {
            name: 'Scala',
            monacoId: 'scala',
            leetCodeId: 'scala',
            fileExtension: 'scala',
            icon: 'fas fa-code',
            template: `object Solution {
    def twoSum(nums: Array[Int], target: Int): Array[Int] = {
        // 在此编写你的代码
        
    }
}`
        },
        dart: {
            name: 'Dart',
            monacoId: 'dart',
            leetCodeId: 'dart',
            fileExtension: 'dart',
            icon: 'fas fa-code',
            template: `class Solution {
  List<int> twoSum(List<int> nums, int target) {
    // 在此编写你的代码
    
  }
}`
        },
        racket: {
            name: 'Racket',
            monacoId: 'scheme',
            leetCodeId: 'racket',
            fileExtension: 'rkt',
            icon: 'fas fa-code',
            template: `(define/contract (two-sum nums target)
  (-> (listof exact-integer?) exact-integer? (listof exact-integer?))
  ;; 在此编写你的代码
  
  )`
        },
        erlang: {
            name: 'Erlang',
            monacoId: 'erlang',
            leetCodeId: 'erlang',
            fileExtension: 'erl',
            icon: 'fas fa-code',
            template: `-spec two_sum(Nums :: [integer()], Target :: integer()) -> [integer()].
two_sum(Nums, Target) ->
    % 在此编写你的代码
    .`
        },
        elixir: {
            name: 'Elixir',
            monacoId: 'elixir',
            leetCodeId: 'elixir',
            fileExtension: 'ex',
            icon: 'fas fa-code',
            template: `defmodule Solution do
  @spec two_sum(nums :: [integer], target :: integer) :: [integer]
  def two_sum(nums, target) do
    # 在此编写你的代码
    
  end
end`
        }
    },

    // 获取语言配置
    getLanguage(langId) {
        return this.languages[langId] || this.languages.javascript;
    },

    // 获取所有语言列表
    getAllLanguages() {
        return Object.entries(this.languages).map(([id, config]) => ({
            id,
            ...config
        }));
    },

    // 获取 Monaco Editor 支持的语言 ID
    getMonacoLanguage(langId) {
        return this.languages[langId]?.monacoId || 'javascript';
    },

    // 获取 LeetCode 语言 ID
    getLeetCodeLanguage(langId) {
        return this.languages[langId]?.leetCodeId || 'javascript';
    },

    // 获取语言模板
    getTemplate(langId, problemId = 1) {
        const lang = this.languages[langId];
        return lang?.template || this.languages.javascript.template;
    },

    // 设置模板（用于动态更新）
    setTemplate(langId, template) {
        if (this.languages[langId]) {
            this.languages[langId].template = template;
        }
    }
};

// 语言分组
const LanguageGroups = {
    popular: ['javascript', 'python', 'java', 'cpp', 'typescript'],
    system: ['c', 'cpp', 'rust', 'go'],
    web: ['javascript', 'typescript', 'php'],
    mobile: ['swift', 'kotlin', 'dart'],
    functional: ['scala', 'racket', 'erlang', 'elixir'],
    other: ['ruby', 'csharp']
};

console.log('语言配置模块已加载，支持', Object.keys(LanguageConfig.languages).length, '种编程语言');
