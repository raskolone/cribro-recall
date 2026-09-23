import { LessonBlueprint, MissionPack } from '../types/lessonStudio';

/**
 * Seed Mission Pack 1
 * Tytuł: "Explain a Problem and Agree on the Next Step" (Poziom: B1)
 * Zgodnie ze specyfikacją Lesson Studio MVP.
 */

export const MISSION_PACK_1: MissionPack = {
  id: 'mission_pack_1',
  title: 'Explain a Problem and Agree on the Next Step',
  communicativeGoal: 'Learner can clearly communicate a workplace delay or error to a stakeholder, explain the root cause concisely, and agree on an actionable resolution.',
  levelVariants: [
    {
      level: 'B1',
      goals: [
        'Explain a discrepancy or delay clearly without over-complicating',
        'Use polite modal expressions to propose a solution and agree on next steps',
        'Maintain professional calmness under time pressure'
      ],
      recommendedDurationMinutes: 60,
      complexityModifier: 'Standard B1 scaffolding with structured framing and guided prompts.'
    }
  ],
  lessonBlueprintIds: ['blueprint_lesson_1'],
  status: 'ready',
  category: 'Workplace Communication',
  tags: ['B1', 'Problem Solving', 'Negotiation', 'Operations', 'Stakeholder Management']
};

export const SEED_LESSON_1_BLUEPRINT: LessonBlueprint = {
  id: 'blueprint_lesson_1',
  missionPackId: 'mission_pack_1',
  title: 'Explain a Problem and Agree on the Next Step',
  targetLevel: 'B1',
  estimatedMinutes: 60,
  version: 1,
  blocks: [
    {
      id: 'block_checkin_recall',
      type: 'check_in',
      title: '1. Check-in & Recall',
      audience: 'both',
      interactionMode: 'collaborate',
      locked: false,
      baseContent: {
        description: 'Quick informal check-in anchored in the learner’s recent workload and a quick recall question from previous topics.',
        prompts: [
          'How has your workload been over the past few days?',
          'Do you recall how we framed a polite update last time?'
        ]
      },
      personalizableSlots: [
        {
          slotId: 'previous_lesson_recall',
          name: 'Previous Lesson Recall Question',
          type: 'text',
          defaultValue: 'How did you handle the last urgent delivery request we discussed?',
          description: 'A recall prompt connecting to the student’s past lessons or specific error history.'
        }
      ]
    },
    {
      id: 'block_mission_briefing',
      type: 'mission_briefing',
      title: '2. Mission Briefing',
      audience: 'both',
      interactionMode: 'view',
      locked: false,
      baseContent: {
        description: 'Set the stage for today’s operational mission. The student discovers an unexpected issue and must brief their counterpart.',
        instructions: 'Read the briefing and understand the scenario context, your specific role, and the urgency of the problem.'
      },
      personalizableSlots: [
        {
          slotId: 'workplace_context',
          name: 'Workplace Context',
          type: 'text',
          defaultValue: 'Supply Chain & Logistics Operations Hub',
          description: 'The industry or department where the scenario takes place.'
        },
        {
          slotId: 'learner_role',
          name: 'Learner Role',
          type: 'text',
          defaultValue: 'Logistics Coordinator',
          description: 'The job title or responsibility assumed by the learner.'
        },
        {
          slotId: 'delivery_item',
          name: 'Delivery Item / Project Asset',
          type: 'text',
          defaultValue: 'Q3 Batch Shipment #8402 (Electronic Sensors)',
          description: 'The specific item, report, or deliverable affected.'
        },
        {
          slotId: 'document_type',
          name: 'Document / Tracking Type',
          type: 'text',
          defaultValue: 'Customs Clearance Manifest & Warehouse Dispatch Note',
          description: 'The document or system reference where the discrepancy was found.'
        },
        {
          slotId: 'discrepancy',
          name: 'Discrepancy / Core Issue',
          type: 'text',
          defaultValue: 'Mismatch between declared container count and actual inventory received at terminal',
          description: 'The exact bottleneck or error that occurred.'
        },
        {
          slotId: 'consequence',
          name: 'Direct Consequence',
          type: 'text',
          defaultValue: 'Assembly line halt scheduled for tomorrow morning if unreleased',
          description: 'The business impact if the issue is not resolved promptly.'
        },
        {
          slotId: 'urgency',
          name: 'Urgency Level',
          type: 'text',
          defaultValue: 'Critical — resolution needed within 4 hours',
          description: 'Time constraint or priority level.'
        }
      ]
    },
    {
      id: 'block_notice_language',
      type: 'input',
      title: '3. Notice the Language',
      audience: 'both',
      interactionMode: 'view',
      locked: false,
      baseContent: {
        description: 'Examine essential phrases and patterns for framing issues diplomatically and proposing collaborative solutions.',
        targetVocab: [
          'There seems to be a discrepancy in...',
          'I wanted to bring this to your attention immediately.',
          'Due to an unforeseen delay with...',
          'What I propose we do is...',
          'Could we agree on the following next step?'
        ],
        grammarFocus: 'Diplomatic problem framing (modal hedging: seem to be, might have occurred, what I suggest)'
      },
      personalizableSlots: [
        {
          slotId: 'target_language',
          name: 'Target Phrases & Key Expressions',
          type: 'vocab_list',
          defaultValue: 'There seems to be an issue with [Item]; The main bottleneck is [Discrepancy]; As a workaround, we can [Action].',
          description: 'Key lexical chunks tailored to the learner’s profession.'
        },
        {
          slotId: 'scaffolding_level',
          name: 'Scaffolding Level / Language Support',
          type: 'choice',
          defaultValue: 'Sentence starters + fill-in cues (Standard B1)',
          description: 'Level of assistance and guided prompts provided during the lesson.'
        }
      ]
    },
    {
      id: 'block_build_report',
      type: 'guided_practice',
      title: '4. Build the Report',
      audience: 'both',
      interactionMode: 'collaborate',
      locked: false,
      baseContent: {
        description: 'Collaboratively assemble the verbal briefing: Fact -> Impact -> Proposed Action. Address common grammatical pitfalls.',
        prompts: [
          'Step 1: State what happened concisely in 1 sentence.',
          'Step 2: Explain why it matters (the direct consequence).',
          'Step 3: Offer 2 realistic next steps.'
        ]
      },
      personalizableSlots: [
        {
          slotId: 'likely_error',
          name: 'Likely Error / High-Frequency Student Mistake',
          type: 'text',
          defaultValue: 'Using overly blunt phrasing ("You made a mistake", "We have problem") instead of diplomatic framing ("There is a discrepancy in the record").',
          description: 'Targeted error trap to address based on the student’s actual grammar/style patterns.'
        }
      ]
    },
    {
      id: 'block_clarification_loop',
      type: 'guided_practice',
      title: '5. Clarification Loop',
      audience: 'both',
      interactionMode: 'collaborate',
      locked: false,
      baseContent: {
        description: 'Simulate unexpected questions or pushback from the stakeholder to practice spontaneous clarifying.',
        prompts: [
          'How does the learner respond when asked for proof or root cause?',
          'How to buy time diplomatically without sounding evasive?'
        ]
      },
      personalizableSlots: [
        {
          slotId: 'follow_up_questions',
          name: 'Stakeholder Follow-up & Pushback Questions',
          type: 'text',
          defaultValue: '1. "Why was this not flagged earlier?"\n2. "Who authorized this adjustment?"\n3. "What guarantee do we have that the new batch arrives on time?"',
          description: 'Realistic probing questions the counterpart will ask in roleplay.'
        }
      ]
    },
    {
      id: 'block_final_mission',
      type: 'final_mission',
      title: '6. Final Mission (Roleplay Simulation)',
      audience: 'both',
      interactionMode: 'student_response',
      locked: false,
      baseContent: {
        description: 'Real-time unscripted simulation: The learner delivers the briefing to the stakeholder, manages pushback, and secures agreement on the next step.',
        instructions: 'Live Roleplay: Call or meet the stakeholder. Explain the discrepancy, handle their questions diplomatically, and confirm the exact time for the next status checkpoint.'
      },
      personalizableSlots: [
        {
          slotId: 'people_involved',
          name: 'Key People & Counterparts Involved',
          type: 'text',
          defaultValue: 'Mark (Regional Operations Director) & Elena (Lead Warehouse Supervisor)',
          description: 'Specific characters or colleagues in the student’s simulated work environment.'
        }
      ]
    },
    {
      id: 'block_optional_branches',
      type: 'custom',
      title: '7. Optional Branches',
      audience: 'teacher_only',
      interactionMode: 'view',
      locked: false,
      baseContent: {
        description: 'Adaptive branch routes if the student finishes early or requires deeper challenge.',
        prompts: [
          'Branch A (Fast progress): Draft a 3-sentence summary email to confirm the agreed action items.',
          'Branch B (Struggling with fluency): Re-run the opening 30 seconds with alternate polite connectors.',
          'Branch C (Escalation challenge): The counterpart demands a financial compensation breakdown.'
        ]
      },
      personalizableSlots: []
    },
    {
      id: 'block_language_harvest',
      type: 'debrief',
      title: '8. Language Harvest & Debrief',
      audience: 'both',
      interactionMode: 'collaborate',
      locked: false,
      baseContent: {
        description: 'Capture active phrases used during the mission, log corrections, and generate flashcard/homework export.',
        prompts: [
          'Highlight top 3 well-executed diplomatic phrases.',
          'Note 2 target corrections for the Recall deck.',
          'Assign follow-up synthesis task.'
        ]
      },
      personalizableSlots: []
    }
  ]
};
