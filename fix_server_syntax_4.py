import re

with open('server.ts', 'r') as f:
    text = f.read()

bad_block3 = """      });
          }
        });
      }"""
text = text.replace(bad_block3, "      });")

with open('server.ts', 'w') as f:
    f.write(text)
