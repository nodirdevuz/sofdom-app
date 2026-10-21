import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { AIChatInput } from '../components/AIChatInput';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
}

const SUGGESTIONS = [
  'Покажи топ-10 товаров по обороту',
  'Какие позиции залежались?',
  'Сводка по остаткам',
  'Сравни закупку и продажу',
];

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  // Автопрокрутка к последнему сообщению.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend(text: string) {
    setMessages((prev) => [
      ...prev,
      { id: prev.length, role: 'user', text },
      {
        id: prev.length + 1,
        role: 'assistant',
        text: 'Это демо-интерфейс ассистента. Реальные ответы можно подключить через Claude API — скажи, и добавлю.',
      },
    ]);
  }

  const empty = messages.length === 0;

  return (
    <div className="h-full flex flex-col">
      {empty ? (
        /* Приветственный экран: герой + поле по центру */
        <div className="flex-1 flex flex-col items-center justify-center gap-7 px-1 pt-[14vh] md:pt-0">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#1f2937] text-white flex items-center justify-center">
              <Sparkles size={26} />
            </div>
            <h1 className="m-0 text-[22px] sm:text-[26px] font-bold tracking-[-0.02em]">ИИ-ассистент</h1>
            <p className="mt-2 mb-0 text-sm text-[#8a94a0] max-w-md mx-auto">
              Задайте вопрос по магазину — товарам, остаткам, аналитике.
            </p>
          </div>

          <AIChatInput onSend={handleSend} className="max-w-2xl" />

          {/* Подсказки-чипсы */}
          <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSend(s)}
                className="px-3.5 py-2 rounded-full border border-[#e6e8eb] bg-white text-[13px] text-[#56616e] font-medium hover:bg-[#f2f3f5] transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Режим диалога: лента сообщений + поле снизу */
        <>
          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            <div className="max-w-2xl mx-auto flex flex-col gap-3 py-2">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      m.role === 'user'
                        ? 'bg-[#1f2937] text-white rounded-[18px] rounded-br-[6px]'
                        : 'bg-[#f3f4f6] text-[#1a1f25] rounded-[18px] rounded-bl-[6px]'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          </div>

          <div className="shrink-0 pt-3 pb-1">
            <div className="max-w-2xl mx-auto">
              <AIChatInput onSend={handleSend} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
