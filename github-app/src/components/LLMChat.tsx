import React, { useState } from "react";
import { useCommits } from "../contexts/CommitContext";
import { useReply } from "../contexts/ReplyContext";
import axios from '../axiosConfig';

interface Message {
  type: "user" | "ai";
  content: string;
}

const LLMChat: React.FC = () => {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const { selectedCommits } = useCommits();
  const { repo } = useReply();

  const handleSend = async () => {
    if (!inputValue.trim() && selectedCommits!=null) return;

  setMessages(prevMessages => [...prevMessages, {type: "user", content: inputValue}]);
  setMessages(prevMessages => [...prevMessages, {type: "ai", content: "..."}]);

    const params = {
      target_sha: selectedCommits?.sha,
      question: inputValue,
    };

    const response = await axios.get(
      `http://localhost:8000/github/repos/${repo?.owner}/${repo?.name}/chat`,
      { params: params }
    );
    const flatHistory: Message[] = [];
    if (response.data && response.data.history) {
      response.data.history.forEach((qaPair: { question?: string; answer?: string }) => {
        if (qaPair.question) { 
          flatHistory.push({ type: 'user', content: qaPair.question });
        }
        if (qaPair.answer !== undefined && qaPair.answer !== null) { 
          flatHistory.push({ type: 'ai', content: qaPair.answer });
        }
      });
    }
    setMessages(flatHistory);
  };

  return (
    <div className="w-[20vw] h-screen flex flex-col items-center bg-gray-800 p-4">
      {/* Title */}
      <h2 className="text-xl text-white font-semibold mb-3">Chat with AI</h2>

      {/* Message list */}
      <div className="text-white w-full h-full flex flex-col overflow-y-auto mb-3 border border-gray-600 rounded p-2">
        {messages.map((msg, idx) => (
          <div key={idx} className="flex my-1">
            {msg.type === "user" ? (
              <p className="ml-auto bg-indigo-600 p-2 rounded whitespace-pre-wrap break-words max-w-[85%]">
                {msg.content}
              </p>
            ) : (
              <p className="mr-auto bg-gray-700 p-2 rounded whitespace-pre-wrap break-words max-w-[85%]">
                {msg.content}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Input + button */}
      <div className="flex flex-row items-center w-full gap-2">
        <input
          className="flex-1 bg-gray-700 text-white rounded p-2 focus:outline-none"
          type="text"
          value={inputValue}
          placeholder="Type your message..."
          onChange={(e) => setInputValue(e.target.value)}
        />
        <button
          onClick={handleSend}
          className="text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default LLMChat;