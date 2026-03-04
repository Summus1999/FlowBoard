/**
 * 测试 RSS 资讯源可用性
 * 用于验证所有配置的 RSS 源是否可访问
 */

const { XMLParser } = require('fast-xml-parser');
const https = require('https');
const http = require('http');

const NEWS_FEED_SOURCES = [
    // 国外科技/AI 资讯
    { id: 'hackernews', name: 'Hacker News', url: 'https://hnrss.org/frontpage' },
    { id: 'theverge', name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
    { id: 'techcrunch', name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
    { id: 'wired', name: 'WIRED', url: 'https://www.wired.com/feed/rss' },
    { id: 'arstechnica', name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
    { id: 'mit-technology-review', name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/' },
    { id: 'venturebeat', name: 'VentureBeat', url: 'https://venturebeat.com/feed/' },
    { id: 'zdnet', name: 'ZDNet', url: 'https://www.zdnet.com/news/rss.xml' },
    
    // 国外财经资讯
    { id: 'coindesk', name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
    { id: 'cointelegraph', name: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
    { id: 'bloomberg-tech', name: 'Bloomberg Technology', url: 'https://feeds.bloomberg.com/technology' },
    { id: 'reuters-business', name: 'Reuters Business', url: 'https://www.reutersagency.com/feed/?best-topics=business&post_type=best' },
    
    // 国外娱乐/综合资讯
    { id: 'bbc-entertainment', name: 'BBC Entertainment', url: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml' },
    { id: 'bbc-world', name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
    { id: 'cnn-tech', name: 'CNN Tech', url: 'http://rss.cnn.com/rss/edition_technology.rss' },
    { id: 'engadget', name: 'Engadget', url: 'https://www.engadget.com/rss.xml' },
    { id: 'gizmodo', name: 'Gizmodo', url: 'https://gizmodo.com/feed' },
    { id: 'mashable', name: 'Mashable', url: 'https://mashable.com/feed' },
    
    // 国内科技资讯
    { id: 'ithome', name: 'IT 之家', url: 'https://www.ithome.com/rss/' },
    { id: 'cnbeta', name: 'cnBeta', url: 'https://rss.cnbeta.com/' },
    { id: '36kr', name: '36 氪', url: 'https://36kr.com/feed' },
    { id: 'huxiu', name: '虎嗅', url: 'https://www.huxiu.com/article/rss.xml' },
    { id: 'tmtpost', name: '钛媒体', url: 'https://www.tmtpost.com/feed' },
    { id: 'geekpark', name: '极客公园', url: 'https://www.geekpark.net/rss' },
    
    // 国内财经资讯
    { id: 'caixin', name: '财新', url: 'https://www.caixin.com/rss/finance.xml' },
    { id: 'jintouwang', name: '金投网', url: 'https://news.cngold.org/rss/rss_news.xml' },
];

const FETCH_TIMEOUT_MS = 10000;
const xmlParser = new XMLParser({ ignoreAttributes: false });

async function fetchWithTimeout(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        
        const req = protocol.get(url, { timeout: FETCH_TIMEOUT_MS }, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve({ status: res.statusCode, data });
            });
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.on('error', (err) => {
            reject(err);
        });
    });
}

async function testSource(source) {
    try {
        const startTime = Date.now();
        const response = await fetchWithTimeout(source.url);
        const duration = Date.now() - startTime;
        
        if (response.status === 200 && response.data) {
            try {
                const parsed = xmlParser.parse(response.data);
                const items = parsed.rss?.channel?.item || parsed.feed?.entry || [];
                const itemCount = Array.isArray(items) ? items.length : 0;
                
                return {
                    id: source.id,
                    name: source.name,
                    status: 'success',
                    statusCode: response.status,
                    duration,
                    itemCount
                };
            } catch (parseError) {
                return {
                    id: source.id,
                    name: source.name,
                    status: 'parse-error',
                    statusCode: response.status,
                    duration,
                    error: parseError.message
                };
            }
        } else {
            return {
                id: source.id,
                name: source.name,
                status: 'http-error',
                statusCode: response.status,
                duration
            };
        }
    } catch (error) {
        return {
            id: source.id,
            name: source.name,
            status: 'failed',
            error: error.message
        };
    }
}

async function runTests() {
    console.log('开始测试 RSS 资讯源...\n');
    console.log('=' .repeat(80));
    
    const results = [];
    
    for (const source of NEWS_FEED_SOURCES) {
        process.stdout.write(`测试 ${source.name.padEnd(25)} ... `);
        const result = await testSource(source);
        results.push(result);
        
        if (result.status === 'success') {
            console.log(`✓ 成功 (${result.duration}ms, ${result.itemCount} 条)`);
        } else {
            console.log(`✗ 失败 (${result.error || result.status})`);
        }
    }
    
    console.log('=' .repeat(80));
    console.log('\n测试结果汇总:\n');
    
    const success = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status !== 'success');
    
    console.log(`总计：${results.length} 个资讯源`);
    console.log(`成功：${success.length} 个 (${Math.round(success.length / results.length * 100)}%)`);
    console.log(`失败：${failed.length} 个`);
    
    if (failed.length > 0) {
        console.log('\n失败的资讯源:');
        failed.forEach(r => {
            console.log(`  - ${r.name}: ${r.error || r.status}`);
        });
    }
    
    if (success.length > 0) {
        console.log('\n成功的资讯源 (按响应时间排序):');
        success.sort((a, b) => a.duration - b.duration).forEach(r => {
            console.log(`  ✓ ${r.name} (${r.duration}ms, ${r.itemCount} 条)`);
        });
    }
    
    console.log('\n' + '=' .repeat(80));
}

// 运行测试
runTests().catch(console.error);
