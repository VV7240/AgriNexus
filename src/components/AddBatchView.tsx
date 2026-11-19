import React, { useState } from 'react';
import { Upload, WifiOff } from 'lucide-react';
import { Batch, CropConstant, Language, User } from '../types';
import { t } from '../utils/i18n';

interface AddBatchViewProps {
  user: User;
  language: Language;
  cropConstants: CropConstant[];
  offlineMode: boolean;
  onSubmitBatch: (payload: Partial<Batch>) => Promise<void>;
  onCancel: () => void;
}

export const AddBatchView: React.FC<AddBatchViewProps> = ({
  user,
  language,
  cropConstants,
  offlineMode,
  onSubmitBatch,
  onCancel,
}) => {
  const isHi = language === 'hi';
  const defaultCrop = cropConstants[0]?.crop ?? 'Tomato';

  const [crop, setCrop] = useState(defaultCrop);
  const [quantityKg, setQuantityKg] = useState('800');
  const [harvestTime, setHarvestTime] = useState(() => {
    const d = new Date(Date.now() - 4 * 60 * 60 * 1000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  const [locality, setLocality] = useState(user.locality || 'Nashik');
  const [ambientTempC, setAmbientTempC] = useState(
    String(cropConstants[0]?.defaultAmbientTempC ?? 28)
  );
  const [storageMode, setStorageMode] = useState<'ambient' | 'cold'>('ambient');
  const [initialQuality, setInitialQuality] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCropConst = cropConstants.find((c) => c.crop === crop);

  function handleCropChange(nextCrop: string) {
    setCrop(nextCrop);
    const found = cropConstants.find((c) => c.crop === nextCrop);
    if (found) {
      setAmbientTempC(String(found.defaultAmbientTempC));
    }
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const qty = Number(quantityKg);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError(isHi ? 'सही मात्रा (किग्रा) दर्ज करें।' : 'Quantity (kg) must be greater than 0.');
      return;
    }
    if (!locality.trim()) {
      setError(isHi ? 'गाँव / क्षेत्र आवश्यक है।' : 'Locality is required.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitBatch({
        crop,
        quantityKg: qty,
        harvestTime: new Date(harvestTime).toISOString(),
        locality: locality.trim(),
        ambientTempC: Number(ambientTempC) || selectedCropConst?.defaultAmbientTempC || 28,
        storageMode,
        initialQuality: initialQuality ? Number(initialQuality) : undefined,
        photoDataUrl,
        notes: notes.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create batch.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#141A15]">
          {t(language, 'registerNewBatch')}
        </h1>
        <p className="text-sm text-[#4B554D] mt-1">
          {isHi
            ? 'कटाई के तुरंत बाद फसल बैच दर्ज करें ताकि लाइव डिजिटल ट्विन और मंडी निर्णय तैयार हो सके।'
            : 'Capture harvested batch details to generate its live quality digital twin and Sell/Store/Process/Redirect recommendation.'}
        </p>
      </div>

      {offlineMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-sm text-amber-900">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>
            {isHi
              ? 'ऑफ़लाइन मोड सक्रिय: यह बैच लोकल कतार में सहेजा जाएगा और ऑनलाइन होते ही सिंक होगा।'
              : 'Offline mode active: batch will be saved locally with an instant offline digital twin and synced on reconnect.'}
          </span>
        </div>
      )}

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-[#E2E6DF] rounded-xl p-6 sm:p-8 space-y-6"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="batch-crop" className="block text-sm font-medium text-[#141A15] mb-1.5">
              {t(language, 'cropType')}
            </label>
            <select
              id="batch-crop"
              value={crop}
              onChange={(e) => handleCropChange(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D4D9D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
            >
              {cropConstants.map((c) => (
                <option key={c.crop} value={c.crop}>
                  {isHi ? `${c.cropHi} (${c.crop})` : c.crop}
                </option>
              ))}
            </select>
            {selectedCropConst && (
              <p className="mt-1.5 text-xs text-[#647066] font-mono tabular-nums">
                Baseline: {selectedCropConst.defaultInitialQuality}% quality ·{' '}
                {selectedCropConst.baseShelfLifeHours}h @ 20°C
              </p>
            )}
          </div>

          <div>
            <label htmlFor="batch-qty" className="block text-sm font-medium text-[#141A15] mb-1.5">
              {t(language, 'quantityKg')}
            </label>
            <input
              id="batch-qty"
              type="number"
              min="1"
              step="1"
              required
              value={quantityKg}
              onChange={(e) => setQuantityKg(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-[#D4D9D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div>
            <label htmlFor="batch-harvest" className="block text-sm font-medium text-[#141A15] mb-1.5">
              {t(language, 'harvestDateTime')}
            </label>
            <input
              id="batch-harvest"
              type="datetime-local"
              required
              value={harvestTime}
              onChange={(e) => setHarvestTime(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-[#D4D9D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div>
            <label htmlFor="batch-locality" className="block text-sm font-medium text-[#141A15] mb-1.5">
              {t(language, 'locality')}
            </label>
            <input
              id="batch-locality"
              type="text"
              required
              value={locality}
              onChange={(e) => setLocality(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D4D9D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div>
            <label htmlFor="batch-temp" className="block text-sm font-medium text-[#141A15] mb-1.5">
              {t(language, 'ambientTemp')}
            </label>
            <input
              id="batch-temp"
              type="number"
              step="0.5"
              value={ambientTempC}
              onChange={(e) => setAmbientTempC(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-[#D4D9D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div>
            <label htmlFor="batch-storage" className="block text-sm font-medium text-[#141A15] mb-1.5">
              {t(language, 'storageMode')}
            </label>
            <select
              id="batch-storage"
              value={storageMode}
              onChange={(e) => setStorageMode(e.target.value as 'ambient' | 'cold')}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D4D9D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
            >
              <option value="ambient">{t(language, 'ambientStorage')}</option>
              <option value="cold">{t(language, 'coldStorage')}</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-[#E2E6DF]">
          <div>
            <label htmlFor="batch-quality" className="block text-sm font-medium text-[#141A15] mb-1.5">
              {t(language, 'initialQualityOptional')}
            </label>
            <input
              id="batch-quality"
              type="number"
              min="20"
              max="100"
              value={initialQuality}
              onChange={(e) => setInitialQuality(e.target.value)}
              placeholder={
                selectedCropConst
                  ? `Default ${selectedCropConst.defaultInitialQuality}%`
                  : 'Default 95%'
              }
              className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-[#D4D9D0] rounded-lg"
            />
          </div>

          <div>
            <label htmlFor="batch-photo" className="block text-sm font-medium text-[#141A15] mb-1.5">
              {t(language, 'producePhotoOptional')}
            </label>
            <label
              htmlFor="batch-photo"
              className="flex items-center justify-center gap-2 px-3.5 py-2.5 text-sm bg-[#F7F8F6] border border-dashed border-[#D4D9D0] rounded-lg cursor-pointer hover:bg-[#F1F3EF]"
            >
              <Upload className="w-4 h-4 text-[#4B554D]" />
              <span className="text-xs font-medium text-[#4B554D]">
                {photoDataUrl
                  ? isHi
                    ? 'फोटो चयनित (बदलें)'
                    : 'Photo attached (replace)'
                  : isHi
                  ? 'फोटो चुनें (JPG/PNG)'
                  : 'Upload produce photo'}
              </span>
            </label>
            <input
              id="batch-photo"
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="sr-only"
            />
          </div>
        </div>

        {photoDataUrl && (
          <div className="flex items-center gap-4 p-3 bg-[#F7F8F6] border border-[#E2E6DF] rounded-lg">
            <img
              src={photoDataUrl}
              alt="Uploaded harvest produce preview"
              className="w-16 h-16 object-cover rounded-md border border-[#E2E6DF]"
            />
            <div className="text-xs text-[#4B554D]">
              Produce photo stored for future computer-vision quality grading (SRS FR-3.2).
            </div>
          </div>
        )}

        <div>
          <label htmlFor="batch-notes" className="block text-sm font-medium text-[#141A15] mb-1.5">
            {isHi ? 'टिप्पणी (वैकल्पिक)' : 'Harvest Notes (optional)'}
          </label>
          <textarea
            id="batch-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isHi ? 'जैसे: सुबह की कटाई, ग्रेड-A' : 'e.g. Morning harvest, crated Grade-A'}
            className="w-full px-3.5 py-2 text-sm bg-white border border-[#D4D9D0] rounded-lg"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E2E6DF]">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[#4B554D] border border-[#D4D9D0] rounded-lg hover:bg-[#F7F8F6]"
          >
            {isHi ? 'रद्द करें' : 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 bg-emerald-700 text-white text-sm font-semibold rounded-lg hover:bg-emerald-800 transition-colors disabled:opacity-50"
          >
            {submitting
              ? isHi
                ? 'सहेजा जा रहा है...'
                : 'Saving...'
              : offlineMode
              ? t(language, 'queueOfflineBatch')
              : t(language, 'submitBatch')}
          </button>
        </div>
      </form>
    </div>
  );
};
