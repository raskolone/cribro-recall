import re

with open('server.ts', 'r') as f:
    text = f.read()

# I will find the leftover catch blocks and remove them
# In parseBulkReplace:
bad_block = """      });
                }
              },
              required: ["lessons"]
            }
          }
        });
      }"""
text = text.replace(bad_block, "      });")

# In parseSingleReplace:
bad_block2 = """      });
                studentSpeaking: { type: Type.STRING },
                thingsToImprove: { type: Type.STRING },
                suggestedFollowUp: { type: Type.STRING },
              },
              required: ["studentId", "lessonTopic", "revisionNotes", "vocabularyText", "studentSpeaking", "thingsToImprove", "suggestedFollowUp"]
            }
          }
        });
      }"""
text = text.replace(bad_block2, "      });")

with open('server.ts', 'w') as f:
    f.write(text)
