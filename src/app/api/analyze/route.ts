import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { basicScreenshot, detailScreenshot } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "서버에 API 키가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    if (!basicScreenshot) {
      return NextResponse.json(
        { error: "스크린샷이 필요합니다." },
        { status: 400 }
      );
    }

    const imageContents = [];

    // Basic screenshot (required)
    imageContents.push({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: getMediaType(basicScreenshot),
        data: basicScreenshot.split(",")[1],
      },
    });

    // Detail screenshot (optional)
    if (detailScreenshot) {
      imageContents.push({
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: getMediaType(detailScreenshot),
          data: detailScreenshot.split(",")[1],
        },
      });
    }

    const prompt = `리그 오브 레전드 게임 결과 스크린샷을 분석해주세요.

${detailScreenshot ? "두 장의 스크린샷이 주어집니다:\n1. 기본 결과창 (KDA, CS, 골드)\n2. 상세 통계 탭 (딜량, 받은 피해량, 시야 점수)" : "기본 결과창 스크린샷 한 장이 주어집니다."}

다음 JSON 형식으로 정확히 응답해주세요. 다른 텍스트 없이 JSON만 반환하세요:

{
  "gameDuration": "MM:SS 형식",
  "players": [
    {
      "nickname": "소환사명",
      "champion": "챔피언 이름 (한글)",
      "team": "blue" 또는 "red",
      "win": true/false,
      "kills": 숫자,
      "deaths": 숫자,
      "assists": 숫자,
      "cs": 숫자,
      "gold": 숫자,
      "damageDealt": 숫자 (챔피언에게 가한 피해),
      "damageTaken": 숫자 (받은 피해),
      "visionScore": 숫자,
      "wardsPlaced": 숫자,
      "wardsDestroyed": 숫자,
      "objectiveDamage": 숫자,
      "ccScore": 숫자,
      "healingDone": 숫자,
      "shieldingDone": 숫자
    }
  ]
}

규칙:
- 블루팀 5명, 레드팀 5명 순서로 작성
- 스크린샷에서 읽을 수 없는 숫자는 0으로
- 닉네임은 정확히 읽어주세요 (한글 초성 포함)
- 승리팀의 win은 true, 패배팀은 false`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              ...imageContents,
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return NextResponse.json(
        { error: err.error?.message || "API 호출에 실패했습니다." },
        { status: response.status }
      );
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "분석 결과를 파싱할 수 없습니다." },
        { status: 500 }
      );
    }

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Analysis error:", err);
    return NextResponse.json(
      { error: "분석 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

function getMediaType(dataUrl: string): string {
  const match = dataUrl.match(/data:([^;]+);/);
  return match?.[1] || "image/png";
}
