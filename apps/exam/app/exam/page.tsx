"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type Question = {
  id: number;
  question: string;
  options: string[];
  correct_answers: string[]; // e.g., ["A","C"]
};

type ExamMeta = {
  title: string;
  durationMinutes: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  passPercentage: number;
};

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function letter(idx: number) {
  return String.fromCharCode(65 + idx); // 0->A
}

function secondsToMMSS(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function ExamPage() {
  const [exam, setExam] = useState<ExamMeta | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, Set<string>>>({});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [showAnswers, setShowAnswers] = useState<Record<number, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);

  // Timer
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lightweight “attempts” kept only in memory (not localStorage)
  const [attempts, setAttempts] = useState<
    { user?: string; timestamp: string; score: number }[]
  >([]);

  // Username (avoid localStorage; fallback to simple default)
  const [userName, setUserName] = useState<string>("Candidate");

  // Confirmation modal
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Mobile responsive
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth < 768);
      }
    };
    checkMobile();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }
  }, []);

  // Load exam + questions; shuffle consistently; set timer
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [e, q] = await Promise.all([
          fetch("/data/exam.json").then((r) => r.json()),
          fetch("/data/questions.json").then((r) => r.json()),
        ]);
        if (!mounted) return;

        // shuffle questions
        const qs = e.shuffleQuestions ? shuffle(q) : q;

        const shaped = qs.map((qq: Question) => {
          const opts = e.shuffleOptions ? shuffle(qq.options) : qq.options;
          const newCorrect = qq.correct_answers.map((L) => {
            const oldIdx = L.charCodeAt(0) - 65;
            const originalOpt = qq.options[oldIdx];
            const newIdx = opts.indexOf(originalOpt);
            return letter(newIdx);
          });
          return { ...qq, options: opts, correct_answers: newCorrect };
        });

        setExam(e);
        setQuestions(shaped);
        setTimeLeft(Math.max(1, e.durationMinutes) * 60); // seconds
      } catch {
        // Minimal offline fallback to avoid hard-fail in artifact
        const fallbackExam: ExamMeta = {
          title: "Sample Mock Exam",
          durationMinutes: 10,
          shuffleQuestions: true,
          shuffleOptions: true,
          passPercentage: 60,
        };
        const fallbackQs: Question[] = [
          {
            id: 1,
            question: "2 + 2 = ?",
            options: ["3", "4", "5", "22"],
            correct_answers: ["B"],
          },
          {
            id: 2,
            question: "Select all prime numbers:",
            options: ["2", "3", "4", "5"],
            correct_answers: ["A", "B", "D"],
          },
        ];
        const qs = fallbackExam.shuffleQuestions
          ? shuffle(fallbackQs)
          : fallbackQs;
        const shaped = qs.map((qq) => {
          const opts = fallbackExam.shuffleOptions
            ? shuffle(qq.options)
            : qq.options;
          const newCorrect = qq.correct_answers.map((L) => {
            const oldIdx = L.charCodeAt(0) - 65;
            const originalOpt = qq.options[oldIdx];
            const newIdx = opts.indexOf(originalOpt);
            return letter(newIdx);
          });
          return { ...qq, options: opts, correct_answers: newCorrect };
        });
        setExam(fallbackExam);
        setQuestions(shaped);
        setTimeLeft(Math.max(1, fallbackExam.durationMinutes) * 60);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Start and manage countdown
  useEffect(() => {
    if (submitted || timeLeft == null) return;
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev == null) return prev;
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          // Auto-submit
          doSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, timeLeft]);

  const totalAnswered = useMemo(
    () => questions.filter((q) => (answers[q.id]?.size || 0) > 0).length,
    [answers, questions]
  );

  const result = useMemo(() => {
    if (!submitted) return null;
    let correct = 0;
    const details = questions.map((q) => {
      const sel = Array.from(answers[q.id] || []);
      const sortedSel = sel.slice().sort();
      const sortedCorr = q.correct_answers.slice().sort();
      const isCorrect =
        JSON.stringify(sortedSel) === JSON.stringify(sortedCorr);
      if (isCorrect) correct += 1;
      return {
        id: q.id,
        question: q.question,
        isCorrect,
        selected: sortedSel,
        correct: sortedCorr,
      };
    });
    const score = Math.round((correct / questions.length) * 100);
    return { correct, total: questions.length, score, details };
  }, [submitted, answers, questions]);

  const toggleChoice = (qid: number, letterChoice: string) => {
    if (submitted) return; // lock after submit
    setAnswers((prev) => {
      const s = new Set(prev[qid] || []);
      // If the question is single-answer (correct_answers.length===1), emulate radio
      const q = questions.find((x) => x.id === qid);
      const isSingle = (q?.correct_answers?.length || 0) === 1;
      if (isSingle) {
        const ns = new Set<string>();
        if (!s.has(letterChoice)) ns.add(letterChoice);
        return { ...prev, [qid]: ns };
      } else {
        if (s.has(letterChoice)) s.delete(letterChoice);
        else s.add(letterChoice);
        return { ...prev, [qid]: s };
      }
    });
  };

  const nextQuestion = () => {
    setCurrentQuestion((i) => Math.min(i + 1, questions.length - 1));
  };
  const prevQuestion = () => {
    setCurrentQuestion((i) => Math.max(i - 1, 0));
  };
  const goToQuestion = (idx: number) => setCurrentQuestion(idx);

  const toggleFlag = (qid: number) => {
    setFlagged((prev) => ({ ...prev, [qid]: !prev[qid] }));
  };

  const toggleShowAnswer = (qid: number) => {
    setShowAnswers((prev) => ({ ...prev, [qid]: !prev[qid] }));
  };

  const doSubmit = () => {
    // compute score
    let correct = 0;
    for (const q of questions) {
      const sel = Array.from(answers[q.id] || []);
      if (
        JSON.stringify(sel.slice().sort()) ===
        JSON.stringify(q.correct_answers.slice().sort())
      ) {
        correct += 1;
      }
    }
    const score = Math.round((correct / questions.length) * 100);
    setSubmitted(true);
    setShowSummary(true);
    setAttempts((prev) => [
      ...prev,
      { user: userName, timestamp: new Date().toISOString(), score },
    ]);
  };

  const confirmSubmit = () => {
    setConfirmOpen(false);
    doSubmit();
  };

  const restart = () => {
    if (!exam || questions.length === 0) return;
    // reshuffle with current exam settings
    const reshuffled = (exam.shuffleQuestions ? shuffle(questions) : questions).map(
      (qq) => {
        const opts = exam.shuffleOptions ? shuffle(qq.options) : qq.options;
        const newCorrect = qq.correct_answers.map((L) => {
          const oldIdx = L.charCodeAt(0) - 65;
          const originalOpt = qq.options[oldIdx];
          const newIdx = opts.indexOf(originalOpt);
          return letter(newIdx);
        });
        return { ...qq, options: opts, correct_answers: newCorrect };
      }
    );

    setQuestions(reshuffled);
    setAnswers({});
    setFlagged({});
    setShowAnswers({});
    setSubmitted(false);
    setShowSummary(false);
    setCurrentQuestion(0);
    setTimeLeft(Math.max(1, exam.durationMinutes) * 60);
  };

  if (!exam || questions.length === 0)
    return <div style={{ padding: 24 }}>Loading exam…</div>;

  const q = questions[currentQuestion];
  const sel = Array.from(answers[q.id] || []);
  const sortedSel = sel.slice().sort();
  const sortedCorr = q.correct_answers.slice().sort();
  const isCorrectAnswer =
    JSON.stringify(sortedSel) === JSON.stringify(sortedCorr);
  const multiSelect = q.correct_answers.length > 1;
  const showCurrentAnswer = showAnswers[q.id] || submitted;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? 12 : 24 }}>
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr auto auto",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>{exam.title}</h2>
          <div style={{ opacity: 0.8, fontSize: 12 }}>Candidate: {userName}</div>
          <div style={{ opacity: 0.7, fontSize: 12, marginTop: 6 }}>
            Rules: {multiSelect ? "Select all that apply" : "Single correct"} per question
            (this hint adjusts per question).
          </div>
        </div>

        {/* Progress */}
        <div
          style={{
            minWidth: isMobile ? "auto" : 260,
            border: "1px solid #2b3a6a",
            borderRadius: 10,
            padding: 10,
            background: "#0e1630",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>
            Progress: {totalAnswered}/{questions.length} answered
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 6,
              background: "#1b264d",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${(totalAnswered / questions.length) * 100}%`,
                background: "#5f7fd4",
                transition: "width .3s",
              }}
            />
          </div>
        </div>

        {/* Timer */}
        <div
          style={{
            minWidth: isMobile ? "auto" : 160,
            border: "1px solid #2b3a6a",
            borderRadius: 10,
            padding: "10px 14px",
            background: timeLeft != null && timeLeft <= 60 ? "#3b1a1a" : "#0e1630",
            color: timeLeft != null && timeLeft <= 60 ? "#ffbbbb" : "inherit",
            textAlign: "center",
            fontWeight: 700,
          }}
        >
          ⏳ {timeLeft != null ? secondsToMMSS(timeLeft) : "--:--"}
          {timeLeft != null && timeLeft <= 60 && (
            <div style={{ fontSize: 11, marginTop: 4 }}>Less than 1 minute!</div>
          )}
        </div>
      </div>

      {/* Top controls */}
      <div
        style={{
          display: "flex",
          gap: 10,
          justifyContent: "space-between",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            background: "#0e1630",
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #2b3a6a",
          }}
        >
          Question {currentQuestion + 1} of {questions.length}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowSummary((s) => !s)}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #2b3a6a",
              background: "#1a2752",
              color: "white",
              cursor: "pointer",
            }}
          >
            {showSummary ? "Back to Questions" : "Open Summary"}
          </button>

          <button
            onClick={() => setConfirmOpen(true)}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #2b3a6a",
              background: "#2b7f4a",
              color: "white",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Submit Exam
          </button>

          {submitted && (
            <button
              onClick={restart}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #2b3a6a",
                background: "#3a4a6a",
                color: "white",
                cursor: "pointer",
              }}
            >
              Retake
            </button>
          )}
        </div>
      </div>

      {/* Summary view */}
      {showSummary && (
        <div
          style={{
            background: "#121a33",
            border: "1px solid #2b3a6a",
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Exam Summary</h3>
          {submitted && result ? (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    background: "#0f2b1a",
                    border: "2px solid #44ff44",
                    borderRadius: 10,
                    padding: 16,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 32, fontWeight: 800, color: "#44ff44" }}>
                    {result.score}%
                  </div>
                  <div>Final Score</div>
                </div>
                <div
                  style={{
                    background: "#0f2b1a",
                    border: "2px solid #44ff44",
                    borderRadius: 10,
                    padding: 16,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 32, fontWeight: 800, color: "#44ff44" }}>
                    {result.correct}
                  </div>
                  <div>Correct</div>
                </div>
                <div
                  style={{
                    background: "#2b121a",
                    border: "2px solid #ff4444",
                    borderRadius: 10,
                    padding: 16,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 32, fontWeight: 800, color: "#ff4444" }}>
                    {result.total - result.correct}
                  </div>
                  <div>Incorrect</div>
                </div>
              </div>
              <div style={{ opacity: 0.8, marginBottom: 8 }}>
                Pass mark: {exam.passPercentage}% —{" "}
                {result.score >= exam.passPercentage ? "✓ Passed" : "✗ Failed"}
              </div>
            </>
          ) : (
            <div style={{ opacity: 0.9 }}>
              Not submitted yet — you can submit anytime with the green button above.
            </div>
          )}

          {/* Navigator grid with legend */}
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
              <LegendBadge color="#3a4a6a" label="Unanswered" />
              <LegendBadge color="#5f7fd4" label="Answered" />
              {submitted && <LegendBadge color="#2b7f4a" label="Correct" />}
              {submitted && <LegendBadge color="#7f2b2b" label="Incorrect" />}
              <LegendBadge color="#b28800" label="Flagged" />
            </div>

            <div style={{ display: "flex", gap: isMobile ? 4 : 6, flexWrap: "wrap" }}>
              {questions.map((qq, idx) => {
                const answered = (answers[qq.id]?.size || 0) > 0;
                const sel = Array.from(answers[qq.id] || []).sort();
                const corr = qq.correct_answers.slice().sort();
                const correct =
                  (submitted || showAnswers[qq.id]) &&
                  answered &&
                  JSON.stringify(sel) === JSON.stringify(corr);
                const incorrect = (submitted || showAnswers[qq.id]) && answered && !correct;

                let bg = answered ? "#5f7fd4" : "#3a4a6a";
                if (submitted || showAnswers[qq.id]) {
                  if (correct) bg = "#2b7f4a";
                  if (incorrect) bg = "#7f2b2b";
                }
                // flagged overlay ring
                const isFlagged = !!flagged[qq.id];

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setShowSummary(false);
                      goToQuestion(idx);
                    }}
                    style={{
                      width: isMobile ? 32 : 36,
                      height: isMobile ? 32 : 36,
                      borderRadius: 8,
                      border: isFlagged ? "2px solid #b28800" : "1px solid #2b3a6a",
                      background: bg,
                      color: "white",
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: isMobile ? 12 : 14,
                    }}
                    title={
                      (isFlagged ? "🚩 " : "") +
                      `Q${idx + 1}: ${answered ? "Answered" : "Unanswered"}${
                        (submitted || showAnswers[qq.id]) ? correct ? " (Correct)" : incorrect ? " (Incorrect)" : "" : ""
                      }`
                    }
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Question card (hidden if just viewing summary) */}
      {!showSummary && (
        <div
          style={{
            background: "#121a33",
            border: "1px solid #2b3a6a",
            borderRadius: 16,
            padding: 24,
            marginBottom: 16,
          }}
        >
          {/* Question header + flag */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: isMobile ? 8 : 10,
              alignItems: "start",
              marginBottom: isMobile ? 16 : 12,
              flexDirection: isMobile ? "column" : "row",
            }}
          >
            <div style={{ 
              fontSize: isMobile ? 16 : 18, 
              fontWeight: 700, 
              lineHeight: isMobile ? 1.5 : 1.4, 
              flex: 1,
              marginBottom: isMobile ? 12 : 0
            }}>
              {q.question}
              <div style={{ 
                fontSize: isMobile ? 13 : 12, 
                opacity: 0.7, 
                marginTop: isMobile ? 8 : 6,
                fontWeight: 500
              }}>
                {q.correct_answers.length > 1
                  ? "Select all that apply"
                  : "Select exactly one"}
              </div>
            </div>

            <div style={{ 
              display: "flex", 
              gap: isMobile ? 6 : 8, 
              flexWrap: "wrap",
              width: isMobile ? "100%" : "auto",
              justifyContent: isMobile ? "center" : "flex-start"
            }}>
              <button
                onClick={() => toggleShowAnswer(q.id)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 20,
                  border: "1px solid #2b7f4a",
                  background: showAnswers[q.id] ? "#2b7f4a" : "transparent",
                  color: showAnswers[q.id] ? "white" : "#2b7f4a",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: isMobile ? 12 : 14,
                }}
                title="Show correct answer for this question"
              >
                💡 {isMobile ? "Answer" : showAnswers[q.id] ? "Hide Answer" : "Show Answer"}
              </button>
              <button
                onClick={() => toggleFlag(q.id)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 20,
                  border: "1px solid #b28800",
                  background: flagged[q.id] ? "#b28800" : "transparent",
                  color: flagged[q.id] ? "#121a33" : "#b28800",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: isMobile ? 12 : 14,
                }}
                title="Mark for review"
              >
                🚩 {isMobile ? "Flag" : flagged[q.id] ? "Flagged" : "Flag"}
              </button>
            </div>
          </div>

          {/* Options */}
          <div style={{ display: "grid", gap: isMobile ? 8 : 10 }}>
            {q.options.map((opt, i) => {
              const L = letter(i);
              const checked = !!answers[q.id]?.has(L);
              const disabled = submitted;
              const isCorrect = q.correct_answers.includes(L);
              const isWrongSel = checked && !isCorrect;
              const showFeedback = showCurrentAnswer;

              // Use checkbox for multi, radio for single (UI only; state enforces behavior)
              const inputType = q.correct_answers.length > 1 ? "checkbox" : "radio";

              return (
                <label
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: isMobile ? "flex-start" : "center",
                    gap: isMobile ? 10 : 10,
                    padding: isMobile ? "12px 14px" : "12px 14px",
                    borderRadius: 8,
                    border: showFeedback
                      ? isCorrect
                        ? "2px solid #44ff44"
                        : isWrongSel
                        ? "2px solid #ff4444"
                        : "1px solid #444"
                      : checked
                      ? "2px solid #5f7fd4"
                      : "1px solid #2b3a6a",
                    background: showFeedback
                      ? isCorrect
                        ? "#0f2b1a"
                        : isWrongSel
                        ? "#3b1a1a"
                        : "#0f1730"
                      : checked
                      ? "#1a2752"
                      : "#0f1730",
                    cursor: disabled ? "default" : "pointer",
                    transition: "all .2s",
                  }}
                >
                  <input
                    type={inputType}
                    disabled={disabled}
                    checked={checked}
                    onChange={() => toggleChoice(q.id, L)}
                  />
                  <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: "bold" }}>
                    {L}.
                  </span>
                  <span style={{ 
                    flex: 1, 
                    fontSize: isMobile ? 15 : 16,
                    lineHeight: isMobile ? 1.4 : 1.2
                  }}>{opt}</span>
                  {showFeedback && isCorrect && (
                    <span style={{ color: "#44ff44", fontWeight: "bold" }}>✓</span>
                  )}
                  {showFeedback && isWrongSel && (
                    <span style={{ color: "#ff4444", fontWeight: "bold" }}>✗</span>
                  )}
                </label>
              );
            })}
          </div>

          {/* Answer feedback for the current question */}
          {showCurrentAnswer && (
            <div
              style={{
                marginTop: isMobile ? 20 : 16,
                padding: isMobile ? 16 : 12,
                background: "#0e1630",
                borderRadius: 8,
                fontSize: isMobile ? 15 : 14,
                lineHeight: 1.5,
              }}
            >
              <strong>Correct Answer:</strong>{" "}
              <span style={{ color: "#44ff44" }}>{q.correct_answers.join(", ")}</span>
              {sortedSel.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong style={{ color: isCorrectAnswer ? "#44ff44" : "#ff4444" }}>
                    Your Answer:
                  </strong>{" "}
                  <span style={{ color: isCorrectAnswer ? "#44ff44" : "#ff4444" }}>
                    {sortedSel.join(", ")}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pager */}
      {!showSummary && (
        <div
          style={{
            display: "flex",
            gap: isMobile ? 4 : 6,
            flexWrap: "wrap",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          {questions.map((qq, idx) => {
            const answered = (answers[qq.id]?.size || 0) > 0;
            const sel = Array.from(answers[qq.id] || []).sort();
            const corr = qq.correct_answers.slice().sort();
            const correct =
              (submitted || showAnswers[qq.id]) && answered && JSON.stringify(sel) === JSON.stringify(corr);
            const incorrect = (submitted || showAnswers[qq.id]) && answered && !correct;

            let bg = answered ? "#5f7fd4" : "#1a2752";
            if (submitted || showAnswers[qq.id]) {
              if (correct) bg = "#2b7f4a";
              if (incorrect) bg = "#7f2b2b";
            }
            const isCurrent = idx === currentQuestion;
            const isFlagged = !!flagged[qq.id];

            return (
              <button
                key={idx}
                onClick={() => goToQuestion(idx)}
                style={{
                  width: isMobile ? 28 : 32,
                  height: isMobile ? 28 : 32,
                  borderRadius: 6,
                  border: isCurrent ? "2px solid #fff" : isFlagged ? "2px solid #b28800" : "1px solid #2b3a6a",
                  background: bg,
                  color: "white",
                  cursor: "pointer",
                  fontWeight: isCurrent ? 800 : 600,
                  fontSize: isMobile ? 12 : 14,
                }}
                title={(isFlagged ? "🚩 " : "") + `Go to question ${idx + 1}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      )}

      {/* Bottom controls */}
      {!showSummary && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: isMobile ? 8 : 16,
            flexDirection: isMobile ? "column" : "row",
          }}
        >
          <button
            onClick={prevQuestion}
            disabled={currentQuestion === 0}
            style={{
              padding: isMobile ? "10px 16px" : "12px 20px",
              borderRadius: 10,
              border: "1px solid #2b3a6a",
              background: currentQuestion === 0 ? "#0a1020" : "#1a2752",
              color: "white",
              cursor: currentQuestion === 0 ? "not-allowed" : "pointer",
              opacity: currentQuestion === 0 ? 0.5 : 1,
              flex: 1,
              width: isMobile ? "100%" : "auto",
            }}
          >
            ← Previous
          </button>

          <button
            onClick={() =>
              currentQuestion === questions.length - 1
                ? setConfirmOpen(true)
                : nextQuestion()
            }
            style={{
              padding: isMobile ? "10px 16px" : "12px 20px",
              borderRadius: 10,
              border: "1px solid #2b3a6a",
              background:
                currentQuestion === questions.length - 1 ? "#2b7f4a" : "#1a2752",
              color: "white",
              cursor: "pointer",
              flex: 1,
              fontWeight: 700,
              width: isMobile ? "100%" : "auto",
            }}
          >
            {currentQuestion === questions.length - 1 ? "Submit" : "Next →"}
          </button>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              width: isMobile ? "90vw" : 420,
              maxWidth: isMobile ? "none" : 420,
              background: "#121a33",
              border: "1px solid #2b3a6a",
              borderRadius: 12,
              padding: isMobile ? 16 : 20,
              margin: isMobile ? "0 16px" : "0",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Submit Exam?</h3>
            <p style={{ opacity: 0.9, lineHeight: 1.5 }}>
              Are you sure you want to submit? You answered{" "}
              <b>{totalAnswered}</b> of <b>{questions.length}</b> questions.
              {Object.values(flagged).some(Boolean) && (
                <>
                  {" "}
                  <br />
                  <span style={{ color: "#b28800" }}>
                    You still have flagged questions.
                  </span>
                </>
              )}
            </p>
            <div style={{ 
              display: "flex", 
              gap: isMobile ? 8 : 10, 
              justifyContent: "flex-end",
              flexDirection: isMobile ? "column" : "row"
            }}>
              <button
                onClick={() => setConfirmOpen(false)}
                style={{
                  padding: isMobile ? "12px 16px" : "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #2b3a6a",
                  background: "#1a2752",
                  color: "white",
                  cursor: "pointer",
                  width: isMobile ? "100%" : "auto",
                  order: isMobile ? 2 : 1,
                }}
              >
                Review More
              </button>
              <button
                onClick={confirmSubmit}
                style={{
                  padding: isMobile ? "12px 16px" : "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #2b3a6a",
                  background: "#2b7f4a",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 700,
                  width: isMobile ? "100%" : "auto",
                  order: isMobile ? 1 : 2,
                }}
              >
                Yes, Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attempts (in-memory) */}
      {attempts.length > 0 && (
        <div
          style={{
            marginTop: 20,
            background: "#0e1630",
            border: "1px solid #2b3a6a",
            borderRadius: 12,
            padding: 16,
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Attempts (session)</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {attempts.map((a, i) => (
              <li key={i} style={{ opacity: 0.9 }}>
                {new Date(a.timestamp).toLocaleString()} — {a.score}%
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function LegendBadge({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        border: "1px solid #2b3a6a",
        borderRadius: 999,
        padding: "6px 10px",
        background: "#0e1630",
        fontSize: 12,
      }}
    >
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 4,
          background: color,
          display: "inline-block",
        }}
      />
      {label}
    </span>
  );
}
