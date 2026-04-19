const DANGER_PATTERNS_LINUX = [
    /rm\s+-rf?\s+[\/~]/i,
    /rm\s+-rf?\s+\*/i,
    /rm\s+-rf/i,
    /dd\s+if=/i,
    /mkfs/i,
    /shred/i,
    /wipefs/i,
    /:\(\)\s*\{:\|:\&\};:/,
    /chmod\s+-R\s+777/i,
    /chown\s+-R/i,
    /curl.*\|\s*(bash|sh)/i,
    /wget.*\|\s*(bash|sh)/i,
    /mv\s+.*\s+\/dev\/null/i,
    />\s*\/dev\/sda/i,
    /fdisk/i,
    /parted/i,
]

const DANGER_PATTERNS_WINDOWS = [
    /Remove-Item\s+-Recurse/i,
    /rm\s+-r/i,
    /Format-/i,
    /reg\s+delete/i,
    /del\s+\/f\s+\/s/i,
    /rmdir\s+\/s/i,
    /cipher\s+\/w/i,
]

const WARNING_PATTERNS = [
    /npm\s+install/i,
    /pip\s+install/i,
    /yarn\s+add/i,
    /git\s+reset\s+--hard/i,
    /git\s+clean\s+-fd/i,
    /git\s+push\s+.*--force/i,
    /chmod/i,
    /chown/i,
    /systemctl\s+(stop|disable|restart)/i,
    /kill\s+-9/i,
    /pkill/i,
    /killall/i,
    /truncate/i,
    /> \S+/,
]

const SAFE_COMMANDS = [
    'ls', 'eza', 'la', 'll', 'pwd', 'cat', 'echo', 'grep', 'find',
    'which', 'whoami', 'uname', 'date', 'uptime', 'df', 'du',
    'ps', 'top', 'htop', 'free', 'env', 'printenv', 'history',
    'man', 'help', 'type', 'file', 'stat', 'wc', 'head', 'tail',
    'sort', 'uniq', 'cut', 'tr', 'sed', 'awk', 'less', 'more',
    'git log', 'git status', 'git diff', 'git branch', 'node --version',
    'npm --version', 'python --version'
]

const classify = (command) => {
    if (!command || typeof command !== 'string') return 'safe'

    const trimmed = command.trim()
    const firstWord = trimmed.split(' ')[0].toLowerCase()
    const isWindows = process.platform === 'win32'

    // sudo always gets flagged as danger
    if (firstWord === 'sudo') {
        return 'danger'
    }

    // check against safe list first
    const isSafe = SAFE_COMMANDS.some(safe =>
        trimmed.toLowerCase().startsWith(safe.toLowerCase())
    )
    if (isSafe) return 'safe'

    // check danger patterns
    const dangerPatterns = isWindows
        ? DANGER_PATTERNS_WINDOWS
        : DANGER_PATTERNS_LINUX

    const isDanger = dangerPatterns.some(pattern => pattern.test(trimmed))
    if (isDanger) return 'danger'

    // check warning patterns
    const isWarning = WARNING_PATTERNS.some(pattern => pattern.test(trimmed))
    if (isWarning) return 'warning'

    return 'safe'
}

const getWarningMessage = (command, level) => {
    if (level === 'danger') {
        if (/rm\s+-rf/i.test(command)) {
            return 'This will permanently delete files. This cannot be undone.'
        }
        if (/dd\s+if=/i.test(command)) {
            return 'dd can overwrite entire disks. This can destroy your system.'
        }
        if (/mkfs/i.test(command)) {
            return 'mkfs will format a partition and erase all data on it.'
        }
        if (/sudo/i.test(command)) {
            return 'This requires root privileges. Make sure you trust this command.'
        }
        if (/curl.*\|\s*(bash|sh)/i.test(command)) {
            return 'Piping curl to bash executes remote code directly. This is risky.'
        }
        return 'This command could cause irreversible damage to your system.'
    }

    if (level === 'warning') {
        if (/git\s+reset\s+--hard/i.test(command)) {
            return 'This will discard all uncommitted changes permanently.'
        }
        if (/git\s+push.*--force/i.test(command)) {
            return 'Force push will overwrite remote history.'
        }
        if (/kill/i.test(command)) {
            return 'This will forcefully terminate a running process.'
        }
        return 'This command makes system changes. Proceed with caution.'
    }

    return ''
}

module.exports = { classify, getWarningMessage }