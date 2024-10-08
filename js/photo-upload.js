import { closeModal } from './util.js';
import { sendData } from './api.js';

const SCALE_MAX_VALUE = 100;
const SCALE_MIN_VALUE = 25;
const SCALE_STEP = 25;

const HASHTAGS_MAX_COUNT = 5;
const DESCRIPTION_MAX_LENGTH = 140;
const Effects = {
  none: { filter: 'none', min: 0, max: 100, step: 1, unit: '' },
  chrome: { filter: 'grayscale', min: 0, max: 1, step: 0.1, unit: '' },
  sepia: { filter: 'sepia', min: 0, max: 1, step: 0.1, unit: '' },
  marvin: { filter: 'invert', min: 0, max: 100, step: 1, unit: '%' },
  phobos: { filter: 'blur', min: 0, max: 3, step: 0.1, unit: 'px' },
  heat: { filter: 'brightness', min: 1, max: 3, step: 0.1, unit: '' },
};

const FILE_TYPES = ['jpg', 'jpeg', 'png'];
const REGEXP = /^#[a-zа-яё0-9]{1,19}$/i;

const uploadPhotoForm = document.querySelector('.img-upload__overlay');
const uploadCancel = uploadPhotoForm.querySelector('#upload-cancel');
const uploadImageForm = document.querySelector('.img-upload__form');
const submitButton = document.querySelector('button#upload-submit');

const smallerScaleButton = uploadImageForm.querySelector('.scale__control--smaller');
const biggerScaleButton = uploadImageForm.querySelector('.scale__control--bigger');
const scaleValueElement = uploadImageForm.querySelector('.scale__control--value');
const previewImage = uploadPhotoForm.querySelector('.img-upload__preview img');

const effectLevelSlider = document.querySelector('.effect-level__slider');
const effectLevelValue = document.querySelector('.effect-level__value');
const effectLevelContainer = document.querySelector('.img-upload__effect-level');
const effectsInputs = uploadPhotoForm.querySelectorAll('.effects__list input');

// Инициализация слайдера
noUiSlider.create(effectLevelSlider, {
  range: {
    min: 0,
    max: 100
  },
  start: 100,
  step: 1,
  connect: 'lower',
});

// Инициализация валидатора Pristine
const pristine = new Pristine(uploadImageForm, {
  classTo: 'img-upload__field-wrapper',
  errorClass: 'img-upload__field-wrapper--invalid',
  successClass: 'img-upload__field-wrapper--valid',
  errorTextParent: 'img-upload__field-wrapper',
  errorTextTag: 'div',
  errorTextClass: 'img-upload__field-wrapper--error',
});

// При изменении слайдера изменяем насыщенность фильтров
effectLevelSlider.noUiSlider.on('slide', () => {
  const currentEffect = Effects[uploadImageForm.querySelector('.effects__radio:checked').value];
  const currentValue = effectLevelSlider.noUiSlider.get();
  previewImage.style.filter = `${currentEffect.filter}(${currentValue}${currentEffect.unit})`;
  effectLevelValue.value = parseFloat(currentValue);
});

// При клике по кнопкам фильтров уровень насыщенности сбрасывается до начального значения (100%): слайдер, фильтр изображения и значение поля обновляются, а если указан "Оригинал" — фильтр сбрасывается, а слайдер скрывается
uploadPhotoForm.querySelector('.effects__list').addEventListener('click', (event) => {
  const target = event.target;
  if (target.classList.contains('effects__radio')) {
    const targetValue = target.value;
    if (targetValue !== 'none') {
      effectLevelContainer.style.display = 'block';
      effectLevelSlider.noUiSlider.updateOptions({
        range: {
          min: Effects[targetValue].min,
          max: Effects[targetValue].max,
        },
        start: Effects[targetValue].max,
        step: Effects[targetValue].step,
      });
      previewImage.style.filter = `${Effects[targetValue].filter}(${Effects[targetValue].max}${Effects[targetValue].unit})`;
      effectLevelValue.value = parseFloat(Effects[targetValue].max);
    } else {
      previewImage.style.filter = 'none';
      effectLevelContainer.style.display = 'none';
    }
  }
});


// TODO: Клик по кнокам скейла можно переделать делегированием
/**
 * Увеличивает скейл изображения-превью
 */
const onBiggerScaleButtonClick = () => {
  const scaleValue = parseInt(scaleValueElement.value, 10);
  if (scaleValue < SCALE_MAX_VALUE) {
    const newScaleValue = scaleValue + SCALE_STEP;
    scaleValueElement.value = `${newScaleValue}%`;
    previewImage.style.transform = `scale(${newScaleValue / 100})`;
  }
};

/**
 * Уменьшает скейл изображения-превью
 */
const onSmallerScaleButtonClick = () => {
  const scaleValue = parseInt(scaleValueElement.value, 10);
  if (scaleValue > SCALE_MIN_VALUE) {
    const newScaleValue = scaleValue - SCALE_STEP;
    scaleValueElement.value = `${newScaleValue}%`;
    previewImage.style.transform = `scale(${newScaleValue / 100})`;
  }
};

/**
 * Закрываем и чистим (приводим в стандартное значение) форму
 */
const onCancelClick = () => {
  closeModal(uploadPhotoForm);

  // Кнопка отправки снова активна
  submitButton.removeAttribute('disabled');

  // Чистим поле файла
  document.querySelector('.img-upload__input').value = '';

  // Возвращаем все поля и стили
  document.querySelector('.img-upload__preview img').style.transform = 'scale(1)';
  uploadPhotoForm.querySelector('.text__hashtags').value = '';
  uploadPhotoForm.querySelector('.text__description').value = '';

  // TODO: Узнать можно ли просто инициализировать клик по кнопке "Оригинал" или это костыль
  effectsInputs.forEach((input) => {
    input.checked = input.id === 'effect-none';
  });

  scaleValueElement.value = '100%';

  previewImage.style.filter = 'none';
  effectLevelContainer.style.display = 'none';

  pristine.destroy();
};

biggerScaleButton.addEventListener('click', onBiggerScaleButtonClick);
smallerScaleButton.addEventListener('click', onSmallerScaleButtonClick);

uploadCancel.addEventListener('click', onCancelClick);

/**
 * Фунция-слушатель для поля файла
 */
const onUploadInputChange = (event) => {
  uploadPhotoForm.classList.remove('hidden');
  effectLevelContainer.style.display = 'none';
  document.body.classList.add('modal-open');

  const file = event.target.files[0];
  const fileName = file.name.toLowerCase();
  const matches = FILE_TYPES.some((fileTipe) => fileName.endsWith(fileTipe));

  if (matches) {
    previewImage.src = URL.createObjectURL(file);

    document.querySelectorAll('.effects__preview').forEach((effectPreview) => {
      effectPreview.style.backgroundImage = `url(${URL.createObjectURL(file)}`;
    });

  }
};

/**
 * Проверяет хештеги в input.text__hashtags на соответствие критериям:
 * - хэштег начинается с символа # (решётка);
 * - строка после решётки должна состоять из букв и чисел и не может содержать пробелы, спецсимволы (#, @, $ и т. п.), символы пунктуации (тире, дефис, запятая и т. п.), эмодзи и т. д.;
 * - хеш-тег не может состоять только из одной решётки;
 * - максимальная длина одного хэштега 20 символов, включая решётку;
 * - хэштеги нечувствительны к регистру: #ХэшТег и #хэштег считаются одним и тем же тегом;
 * - хэштеги необязательны.
 * @param {*} value - Значение проверяемого input
 * @returns {boolean} - true, если число хештегов равно или менее HASHTAGS_MAX_COUNT
 */
const validateHashtags = (value) => {
  value = value.trim();

  if (value === '') {
    return true;
  }

  const hashtags = value.split(' ').map((hashtagMapElement) => hashtagMapElement.trim()).filter((hashtagFilterElement) => hashtagFilterElement !== '');
  const allValid = hashtags.every((hashtag) => REGEXP.test(hashtag));

  if (!allValid) {
    return false;
  }

  return true;
};

pristine.addValidator(uploadImageForm.querySelector('.text__hashtags'), validateHashtags, 'Введён невалидный хэштег', 1);

/**
 * Проверяет количество хештегов в input.text__hashtags
 * @param {string} value - Значение проверяемого input
 * @returns {boolean} - true, если число хештегов равно или менее HASHTAGS_MAX_COUNT
 */
const checkHashtagsCount = (value) => {
  value = value.trim();

  if (value === '') {
    return true;
  }

  const hashtags = value.split('#').slice(1);
  return hashtags.length <= HASHTAGS_MAX_COUNT;
};

pristine.addValidator(uploadImageForm.querySelector('.text__hashtags'), checkHashtagsCount, 'Превышено количество хэштегов', 2);

/**
 * Проверяет уникальность хештегов в input.text__hashtags
 * @param {string} value - Значение проверяемого input
 * @returns {boolean} - true, если все хештеги уникальны
 */
const checkHashtagsUnique = (value) => {
  value = value.trim();

  const hashtags = value.split(' ').map((hashtagMapElement) => hashtagMapElement.trim()).filter((hashtagFilterElement) => hashtagFilterElement !== '');
  const uniqueHashtags = new Set(hashtags.map((tag) => tag.toLowerCase()));
  return uniqueHashtags.size === hashtags.length;
};

pristine.addValidator(uploadImageForm.querySelector('.text__hashtags'), checkHashtagsUnique, 'Хэштеги повторяются', 3);

/**
 * Проверяет длину значения textarea.text__description
 * @param {string} value — Значение проверяемого textarea
 * @returns {boolean} - true, если длина значения меньше или равна DESCRIPTION_MAX_LENGTH
 */
const checkDescriptionLength = (value) => {
  value = value.trim();
  return value.length <= DESCRIPTION_MAX_LENGTH;
};

pristine.addValidator(uploadImageForm.querySelector('.text__description'), checkDescriptionLength, 'Длина комментария больше 140 символов');

/**
 * Создаёт элемент из шаблона (ошибка или успех), добавляет в body и возвращает этот элемент
 * @param {string} type Тип элемента ('error' или 'success')
 * @returns {Element} Созданный элемент
 */
const showFetchMessage = (type) => {
  document.body.append(document.querySelector(`#${type}`).content.cloneNode(true));
  return document.querySelector(`.${type}`);
};

/**
 * Слушатель проверяет все клики по документу. Если клик НЕ по внутреннему блоку или его дочерним элементам — удаляет блок, а затем и сам слушатель
 * @param {Event} event Событие клика по документу
 * @param {Element} messageBlock Элемент, который нужно закрыть (ошибка или успех)
 * @param {string} type Тип блока ('error' или 'success')
 */
const onDocumentClick = (event, messageBlock, type) => {
  const innerBlockClass = `.${type}__inner`;
  const buttonClass = `.${type}__button`;

  // Проверяем, был ли клик вне внутреннего блока
  if (!messageBlock.querySelector(innerBlockClass).contains(event.target) && event.target !== messageBlock.querySelector(buttonClass)) {
    messageBlock.remove(); // Удаляем блок
    document.removeEventListener('click', (e) => onDocumentClick(e, messageBlock, type));
  }
};

// Обработка submit-а формы
uploadImageForm.addEventListener('submit', (event) => {
  event.preventDefault();

  if (pristine.validate()) {
    submitButton.setAttribute('disabled', true);

    // Если валидация прошла — отсылаем аякс запроc
    const formData = new FormData(event.target);

    sendData(formData)
      // Если успех — чистим и закрываем форму
      .then(() => {

        onCancelClick();
        const successBlock = showFetchMessage('success');

        // Обработчик клика по документу
        document.addEventListener('click', (evt) => onDocumentClick(evt, successBlock, 'success'));

        // Обработчик клика по кнопке закрытия успеха
        successBlock.querySelector('.success__button').addEventListener('click', () => {
          successBlock.remove(); // Удаляем блок успеха
        });
      })
      .catch(() => {
        // Если ошибка — показываем соответствующую ошибку
        const errorBlock = showFetchMessage('error');

        // Обработчик клика по документу
        document.addEventListener('click', (evt) => onDocumentClick(evt, errorBlock, 'error'));

        // Кнопка отправки снова активна
        submitButton.removeAttribute('disabled');

        // Обработчик клика по кнопке закрытия ошибки
        errorBlock.querySelector('.error__button').addEventListener('click', () => {
          errorBlock.remove(); // Удаляем блок ошибки
        });
      });
  }
});

/**
 * Инициализация слушателя поля загрузки изображений
 */
const initUploadPhotoInput = () => {
  document.querySelector('.img-upload__input').addEventListener('change', (event) => onUploadInputChange(event));
};

export { initUploadPhotoInput, onCancelClick };
