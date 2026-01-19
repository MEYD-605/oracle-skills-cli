/**
 * Oracle Skills Plugin for OpenCode
 * Adds "oracle-skills:" prefix to identify sessions with Oracle skills installed
 */
import type { Plugin } from "@opencode-ai/plugin"

const PREFIX = "oracle-skills:"

const OracleSkillsPlugin: Plugin = () => ({
  name: "oracle-skills",
  
  "experimental.chat.messages.transform": (_input: any, output: any) => {
    if (output?.messages && Array.isArray(output.messages)) {
      for (const msg of output.messages) {
        const role = msg.info?.role || msg.role
        if (role === "user" && msg.parts && Array.isArray(msg.parts)) {
          for (const part of msg.parts) {
            if (part.type === "text" && part.text && !part.text.startsWith(PREFIX)) {
              part.text = `${PREFIX} ${part.text}`
            }
          }
        }
      }
    }
  },
})

export default OracleSkillsPlugin
