import { Injectable } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { SentinelService } from '@app/sentinel/sentinel.service';
import { FieldsService } from '@app/fields/fields.service';

@Injectable()
export class AiAnalysisReportService {
  private genAI: GoogleGenAI;
  private model: any;
  constructor(
    private readonly sentinelService: SentinelService,
    private readonly fieldsService: FieldsService,
  ) {
    this.genAI = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }

  async generateReport(
    fieldId: string,
    userId: string,
    language?: 'English' | 'Ukrainian',
  ) {
    const field = await this.fieldsService.getFieldById(fieldId, userId);
    const stats = await this.sentinelService.getFieldIndices(fieldId);
    const distribution = await this.sentinelService.getFieldImages(fieldId);

    const cropType = field.cropType || 'Unknown';
    const historicalData = stats.slice(-3).map((entry) => ({
      date: entry.date,
      ndvi: entry.ndvi,
      evi: entry.evi,
      ndmi: entry.ndmi,
      savi: entry.savi,
    }));

    const latestDistribution = distribution[distribution.length - 1]
      ?.distribution || {
      excellent: 0,
      good: 0,
      moderate: 0,
      poor: 0,
    };

    const ukrainianPrompt = `
            Ти — експертний агроном-аналітик системи AgroMap. Твоє завдання — проаналізувати динаміку супутникових індексів та надати професійний висновок.

            ВАЖЛИВО: Надай відповідь мовою: ${language || 'English'}.

            Вхідні дані:
            1. Культура: ${cropType || 'Не вказано'}
            2. Поточна дата аналізу: ${new Date().toLocaleDateString()}
            3. Розподіл площі (останній): E:${latestDistribution.excellent}%, G:${latestDistribution.good}%, M:${latestDistribution.moderate}%, P:${latestDistribution.poor}%
            4. Історичні дані (останні 3 записи): ${JSON.stringify(historicalData)}

            Твоє завдання:
            - Порівняй поточні значення індексів з попередніми (тренд).
            - Оціни стан вегетації (NDVI, EVI) та рівень зволоження (NDMI).
            - Використовуй SAVI для коригування впливу ґрунту, якщо вегетація низька.
            - Врахуй, який зараз місяць.
            - Рекомендації надавай якщо воно потрібні, але не вигадуй їх без потреби.
            - Ризики формуй лише на основі отриманих даних, не вигадуй їх без потреби.

            ВИМОГА ДО ФОРМАТУ: Надай відповідь СТРОГО у форматі JSON. Не додавай зайвого тексту до або після JSON.
            Структура JSON:
                {
                "status": "Короткий опис загального стану (1 речення)",
                "stressLevel": "Low/Medium/High",
                "analysis": "Аналіз динаміки індексів (чому вони ростуть або падають), КОРОТКО без зайвих деталей",
                "risks": ["ризик 1", "ризик 2"],
                "recommendations": ["порада 1", "порада 2"]
                }
    `;

    const englishPrompt = `
  You are an expert agronomic analyst for the AgroMap system. 
  Your task is to analyze the dynamics of satellite indices and provide a professional conclusion.
  
  IMPORTANT: PROVIDE THE RESPONSE STRICTLY IN THIS LANGUAGE: ${language || 'English'}.

  INPUT DATA:
  1. Crop Type: ${cropType || 'Not specified'}
  2. Analysis Date: ${new Date().toLocaleDateString()}
  3. Latest Area Distribution: Excellent:${latestDistribution.excellent}%, Good:${latestDistribution.good}%, Moderate:${latestDistribution.moderate}%, Poor:${latestDistribution.poor}%
  4. Historical Data (last 3 records): ${JSON.stringify(historicalData)}

  INSTRUCTIONS:
  - Compare current index values with previous ones (trends).
  - Evaluate vegetation status (NDVI, EVI) and moisture levels (NDMI).
  - Use SAVI to adjust for soil influence if vegetation is low.
  - Consider the current month (${new Date().toLocaleString('default', { month: 'long' })}).
  - Provide recommendations and risks ONLY if they are justified by the data; do not hallucinate them.

  IMPORTANT: PROVIDE THE RESPONSE STRICTLY IN THIS LANGUAGE: ${language || 'English'}.


  FORMAT REQUIREMENT:
  Return the response STRICTLY as a JSON object. No preamble or post-text.
  JSON Structure:
  {
    "status": "Short description of general condition (1 sentence)",
    "stressLevel": "Low/Medium/High",
    "analysis": "Brief analysis of index dynamics (why they are rising or falling)",
    "risks": ["risk 1", "risk 2"],
    "recommendations": ["advice 1", "advice 2"]
  }
`;

    const response = await this.genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      //   contents: language === 'Ukrainian' ? ukrainianPrompt : englishPrompt,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `IMPORTANT: You must output the JSON only in ${language}. No other language is allowed.\n\n${language === 'Ukrainian' ? ukrainianPrompt : englishPrompt}`,
            },
          ],
        },
      ],

      config: {
        responseMimeType: 'application/json',
      },
    });

    return response.text;
  }
}
