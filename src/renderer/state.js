export const state = {
  lineBuffer: '',
  aiMode: false,       // waiting for y/n confirmation
  aiProcessing: false, // AI query in progress
  isChatting: false,   // immersive chat conversation mode
  shouldResumeChat: false, // return to chat after command executes
  pendingCommand: '',

  // --- AI History ---
  aiHistory: [],
  aiHistoryIndex: -1,
  currentInputSave: '',

  // --- Output capture ---
  outputBuffer: '',
  outputTimer: null,
  captureCommand: '',   // command whose output we're capturing
  capturing: false,     // currently capturing output
  
  // --- UI state ---
  chatBannerShown: false,
  spinnerInterval: null,
  spinnerIndex: 0
};
