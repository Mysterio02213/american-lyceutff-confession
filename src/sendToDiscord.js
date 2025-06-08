const WEBHOOK_URL =
  "https://discord.com/api/webhooks/1380277483433365545/HN-JYbNfbiRiZkE0uqNFOBntYxdQd9bpwfYLOYS5H0J6m5mTf3tW9GJo0q5_4CEkaBM9";

/**
 * Send a message to Discord.
 * @param {string} message - The message content.
 * @param {("confession"|"report")} type - The type of message.
 */
export default async function sendToDiscord(message, type = "confession") {
  try {
    const payload = {
      content:
        type === "report"
          ? `🚩 **Confession Reported:**\n${message}`
          : `📨 **New Confession:**\n${message}`,
    };

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return res.ok;
  } catch (err) {
    console.error("Error sending to Discord:", err);
    return false;
  }
}
