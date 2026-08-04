const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /else \{\n\s*const errorText = await response\.text\(\);\n\s*console\.warn\(`ElevenLabs API returned \$\{response\.status\}: \$\{errorText\}, falling back to Google TTS`\);\n\s*\}\n\s*\} catch \(elError\) \{\n\s*console\.warn\('ElevenLabs request failed, falling back to Google TTS:', elError\);\n\s*\}\n\s*\}\n\n\s*\/\/ Fallback to Google Translate TTS[\s\S]*?res\.send\(Buffer\.from\(audioBuffer\)\);\n\s*\} catch \(error: any\) \{/g;

const replacement = `else {
            const errorText = await response.text();
            console.error(\`ElevenLabs API returned \${response.status}: \${errorText}\`);
            throw new Error(\`ElevenLabs API error: \${response.status}\`);
          }
        } catch (elError) {
          console.error('ElevenLabs request failed:', elError);
          throw elError;
        }
      } else {
        throw new Error('ElevenLabs API key is missing. Ensure VITE_ELEVENLABS_API_KEY is configured.');
      }
    } catch (error: any) {`;

code = code.replace(regex, replacement);
fs.writeFileSync('server.ts', code);
