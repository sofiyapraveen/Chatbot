import { useEffect, useRef, useState } from "react";
import { companyInfo } from "./companyInfo";
import { gapi } from "gapi-script";

const CLIENT_ID = import.meta.env.VITE_AUTH_CLIENT_ID;
const API_KEY = import.meta.env.VITE_API_KEY;
const SCOPES = "https://www.googleapis.com/auth/spreadsheets.readonly";
const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;
const API_URL = import.meta.env.VITE_API_URL;

const App = () => {
  const [chatHistory, setChatHistory] = useState([
    { hideInChat: true, role: "model", text: companyInfo },
  ]);
  const [showChatbot, setShowChatbot] = useState(false);

  const chatBodyRef = useRef();

  const generateBotResponse = async (history) => {
    const updateHistory = (text, isError = false) => {
      setChatHistory((prev) => [
        ...prev.filter((msg) => msg.text !== "Thinking..."),
        { role: "model", text, isError },
      ]);
    };

    const formattedHistory = history.map(({ role, text }) => ({
      role,
      parts: [{ text }],
    }));

    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ contents: formattedHistory }),
    };

    try {
      const response = await fetch(API_URL, requestOptions);
      const data = await response.json();

      if (!response.ok || !data.candidates?.length) {
        throw new Error(data.error?.message || "Something went wrong!");
      }

      const apiResponseText = data.candidates[0].content.parts[0]?.text
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .trim();

      updateHistory(apiResponseText);
    } catch (error) {
      updateHistory("Error: " + error.message, true);
    }
  };

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({
        top: chatBodyRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [chatHistory]);

  useEffect(() => {
    function start() {
      gapi.client
        .init({
          apiKey: API_KEY,
          clientId: CLIENT_ID,
          discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
          scope: SCOPES,
        })
        .then(() => {
          const authInstance = gapi.auth2.getAuthInstance();
          authInstance.isSignedIn.listen(updateSigninStatus);

          if (authInstance.isSignedIn.get()) {
            makeApiCall();
          } else {
            authInstance.signIn();
          }
        })
        .catch((error) => console.error("GAPI Initialization Error:", error));
    }

    gapi.load("client:auth2", start);
  }, []);

  function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
      makeApiCall();
    }
  }

  function makeApiCall() {
    gapi.client.sheets.spreadsheets.values
      .get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Sheet1!A1:D10",
      })
      .then(
        (response) => {
          console.log("Google Sheets Data:", response.result.values);
        },
        (error) => {
          console.error("Google Sheets API Error:", error);
        }
      );
  }

  return (
    <div className={`container ${showChatbot ? "show-chatbot" : ""}`}>
      <button onClick={() => setShowChatbot((prev) => !prev)} id="chatbot-toggler">
        <span className="material-symbols-rounded">mode_comment</span>
        <span className="material-symbols-rounded">close</span>
      </button>
      <div className="chatbot-popup">
        <div className="chat-header">
          <div className="header-info">
            <ChatbotIcon />
            <h2 className="logo-text">Chatbot</h2>
          </div>
          <button onClick={() => setShowChatbot(false)} className="material-symbols-rounded">
            keyboard_arrow_down
          </button>
        </div>

        <div ref={chatBodyRef} className="chat-body">
          <div className="message bot-message">
            <ChatbotIcon />
            <p className="message-text">
              Hey there! <br /> How can I help you today?
            </p>
          </div>

          {chatHistory.map((chat, index) => (
            <ChatMessage key={index} chat={chat} />
          ))}
        </div>

        <div className="chat-footer">
          <ChatForm
            chatHistory={chatHistory}
            setChatHistory={setChatHistory}
            generateBotResponse={generateBotResponse}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
