import { EnrichedBatch, Language, MarketPrice } from '../types';
import { getActionLabel } from './i18n';

export function buildOfflineTemplateReply(
  query: string,
  language: Language,
  batch?: EnrichedBatch,
  marketPrices: MarketPrice[] = []
): { text: string; uncertain: boolean; escalateHelpdesk: boolean } {
  const q = query.toLowerCase();

  if (!batch) {
    return {
      text:
        language === 'hi'
          ? 'ऑफ़लाइन मोड में कृपया पहले एक सक्रिय बैच चुनें ताकि मैं उसकी गुणवत्ता, शेल्फ-लाइफ और मंडी सुझाव की जानकारी दे सकूँ। अधिक सहायता के लिए FPO हेल्पडेस्क से संपर्क करें।'
          : 'In offline mode, please select an active batch so I can provide grounded quality, shelf-life, and recommendation details. Contact FPO helpdesk for further assistance.',
      uncertain: true,
      escalateHelpdesk: true,
    };
  }

  const cropPrices = marketPrices.filter(
    (p) => p.crop.toLowerCase() === batch.crop.toLowerCase()
  );

  const isQualityQuery =
    q.includes('quality') ||
    q.includes('spoil') ||
    q.includes('shelf') ||
    q.includes('गुणवत्ता') ||
    q.includes('खराब') ||
    q.includes('लाइफ');

  const isPriceQuery =
    q.includes('price') ||
    q.includes('mandi') ||
    q.includes('market') ||
    q.includes('भाव') ||
    q.includes('मंडी') ||
    q.includes('दाम');

  const isWhyQuery =
    q.includes('why') ||
    q.includes('recommend') ||
    q.includes('sell') ||
    q.includes('store') ||
    q.includes('redirect') ||
    q.includes('process') ||
    q.includes('क्यों') ||
    q.includes('सुझाव') ||
    q.includes('बेच') ||
    q.includes('भंडार');

  if (isQualityQuery) {
    return {
      text:
        language === 'hi'
          ? `[ऑफ़लाइन टेम्पलेट] बैच ${batch.id} (${batch.crop}, ${batch.quantityKg} किग्रा): वर्तमान गुणवत्ता स्कोर ${batch.digitalTwin.qualityScore}% है, खराबी का जोखिम ${batch.digitalTwin.spoilageRisk}% है और शेष शेल्फ लाइफ ${batch.digitalTwin.remainingShelfLifeHours} घंटे है (${batch.ambientTempC}°C पर)।`
          : `[Offline Template] Batch ${batch.id} (${batch.crop}, ${batch.quantityKg} kg): Current quality score is ${batch.digitalTwin.qualityScore}%, spoilage risk is ${batch.digitalTwin.spoilageRisk}%, and remaining shelf life is ${batch.digitalTwin.remainingShelfLifeHours} hours at ${batch.ambientTempC}°C.`,
      uncertain: false,
      escalateHelpdesk: false,
    };
  }

  if (isPriceQuery && cropPrices.length > 0) {
    const summary = cropPrices
      .slice(0, 3)
      .map((p) => `${p.mandi}: ₹${p.pricePerKg}/kg (${p.trend})`)
      .join(', ');
    return {
      text:
        language === 'hi'
          ? `[ऑफ़लाइन टेम्पलेट] ${batch.crop} के अंतिम सिंक किए गए मंडी भाव: ${summary}।`
          : `[Offline Template] Last synced mandi prices for ${batch.crop}: ${summary}.`,
      uncertain: false,
      escalateHelpdesk: false,
    };
  }

  if (isWhyQuery) {
    const rec = batch.recommendation;
    const actionLabel = getActionLabel(language, rec.recommendedAction);
    return {
      text:
        language === 'hi'
          ? `[ऑफ़लाइन टेम्पलेट] बैच ${batch.id} के लिए सुझावित कार्रवाई "${actionLabel}" है (अनुमानित शुद्ध मूल्य ₹${rec.expectedValue.toLocaleString('en-IN')})। ${rec.explanationHi}`
          : `[Offline Template] Recommended action for batch ${batch.id} is "${actionLabel}" (Expected net value ₹${rec.expectedValue.toLocaleString('en-IN')}). ${rec.explanationEn}`,
      uncertain: false,
      escalateHelpdesk: false,
    };
  }

  return {
    text:
      language === 'hi'
        ? 'मैं केवल आपके लाइव बैच, मंडी भाव और फसल-उपरांत निर्णय से जुड़े प्रश्नों का उत्तर दे सकता हूँ। इस प्रश्न का सटीक उत्तर मेरे ऑफ़लाइन डेटा में उपलब्ध नहीं है — कृपया ऑनलाइन जुड़ें या FPO हेल्पडेस्क से संपर्क करें।'
        : 'I am restricted to answering questions grounded in your live batch data, mandi prices, and post-harvest recommendations. I am uncertain about this specific query in offline mode — please connect online or contact the FPO helpdesk.',
    uncertain: true,
    escalateHelpdesk: true,
  };
}
