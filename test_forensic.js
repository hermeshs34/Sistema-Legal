import crypto from 'crypto';

async function generateHash(content) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function testForensicintegrity() {
    const testHtml = "<div>Test Forensic Content</div>";
    const refCode = "TEST-REF-001";
    
    console.log("--- Forensic Integrity Test ---");
    console.log(`Content: ${testHtml}`);
    
    const hash = await generateHash(testHtml);
    console.log(`Generated Hash (SHA-256): ${hash}`);
    
    if (hash && hash.length === 64) {
        console.log("PASS: Hash is a valid SHA-256 string.");
    } else {
        console.log("FAIL: Invalid hash length.");
    }
}

testForensicintegrity().catch(console.error);
