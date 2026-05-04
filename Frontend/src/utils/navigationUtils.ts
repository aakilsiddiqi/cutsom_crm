import { CommonActions, NavigationProp } from '@react-navigation/native';
import { Platform } from 'react-native';

export const navigateToDashboard = (navigation: any, role: 'admin' | 'user') => {
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

export const navigateToJobDetail = (navigation: any, role: 'admin' | 'user', jobSheetId: string) => {
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

export const navigateBack = (navigation: any) => {
  if (navigation.canGoBack()) {
    navigation.goBack();
  } else {
    navigation.dispatch(CommonActions.goBack());
  }
};
