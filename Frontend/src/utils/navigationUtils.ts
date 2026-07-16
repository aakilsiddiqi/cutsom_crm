import { CommonActions } from '@react-navigation/native';
import { Platform } from 'react-native';

type Navigation = {
  dispatch: (action: ReturnType<typeof CommonActions.reset | typeof CommonActions.navigate | typeof CommonActions.goBack>) => void;
  navigate: (name: string) => void;
  canGoBack: () => boolean;
  goBack: () => void;
};

export const navigateToDashboard = (navigation: Navigation, role: 'admin' | 'user') => {
  if (role === 'admin') {
    if (Platform.OS === 'web') {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ 
            name: 'AdminTabs',
            state: {
              routes: [{ name: 'Dashboard' }],
              index: 0
            }
          }]
        })
      );
    } else {
      navigation.navigate('AdminTabs');
    }
  } else {
    if (Platform.OS === 'web') {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'UserDashboard' }]
        })
      );
    } else {
      navigation.navigate('UserDashboard');
    }
  }
};

export const navigateToJobDetail = (navigation: Navigation, role: 'admin' | 'user', jobSheetId: string) => {
  if (role === 'admin') {
    navigation.dispatch(
      CommonActions.navigate({
        name: 'JobDetailAdminScreen',
        params: { jobSheetId }
      })
    );
  } else {
    navigation.dispatch(
      CommonActions.navigate({
        name: 'JobSheetDetail',
        params: { jobSheetId }
      })
    );
  }
};

export const navigateBack = (navigation: Navigation) => {
  if (navigation.canGoBack()) {
    navigation.goBack();
  } else {
    navigation.dispatch(CommonActions.goBack());
  }
};
