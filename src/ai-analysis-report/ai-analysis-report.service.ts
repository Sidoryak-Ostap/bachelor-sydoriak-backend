import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { SentinelService } from '@app/sentinel/sentinel.service';
import { FieldsService } from '@app/fields/fields.service';

@Injectable()
export class AiAnalysisReportService {
  private CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
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

    const interpretation = field?.interpretation;

    if (
      interpretation &&
      new Date().getTime() - new Date(interpretation.generatedAt).getTime() <
        this.CACHE_TTL_MS
    ) {
      return interpretation;
    }

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

    try {
      const response = await this.genAI.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${ukrainianPrompt} \n\n Важливо: Ти повинен надати відповідь в JSON форматі ${language} мовою. Жодна інша мова не допускається.`,
              },
            ],
          },
        ],

        config: {
          responseMimeType: 'application/json',
        },
      });

      const jsonText = response.text;
      const parsedData = JSON.parse(jsonText || '');

      await this.fieldsService.updateFieldInterpretation(
        fieldId,
        userId,
        parsedData,
      );

      return parsedData;
    } catch (error) {
      console.error('Помилка генерації або парсингу тексту з Gemini:', error);

      throw new InternalServerErrorException(
        'Не вдалося отримати коректний аналіз поля.',
      );
    }
  }
}
