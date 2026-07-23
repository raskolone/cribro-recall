import re

with open('server.ts', 'r') as f:
    text = f.read()

# We need to remove the extra closing brackets around line 243
text = text.replace("""      let response = await generateContentWithRetry(ai, contents, {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.4
      });

        });
      }""", """      let response = await generateContentWithRetry(ai, contents, {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.4
      });""")

# parseBulkReplace (line 383ish)
text = text.replace("""      let response = await generateContentWithRetry(ai, contents, {
        systemInstruction: sysInstruction,
        responseMimeType: "application/json",
        responseSchema: schema
      });

        });
      }""", """      let response = await generateContentWithRetry(ai, contents, {
        systemInstruction: sysInstruction,
        responseMimeType: "application/json",
        responseSchema: schema
      });""")

# parseSingleReplace (line 512ish)
text = text.replace("""      let response = await generateContentWithRetry(ai, promptContext, {
        systemInstruction: sysInstruction,
        responseMimeType: "application/json",
        responseSchema: schema
      });

        });
      }""", """      let response = await generateContentWithRetry(ai, promptContext, {
        systemInstruction: sysInstruction,
        responseMimeType: "application/json",
        responseSchema: schema
      });""")

with open('server.ts', 'w') as f:
    f.write(text)
